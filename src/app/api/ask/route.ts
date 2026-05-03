// ORCHESTRATOR — streaming NDJSON
//
// Sequences the four pipeline phases and streams each result to the client
// as it completes. The frontend renders each pipeline row live.
//
// Wire format (one JSON object per line):
//   { type: "step", step: PipelineStep }
//   { type: "done", reply, newFacts, jobContext }
//   { type: "error", message }
//
// ┌──────────────────────────────────────────────────────────────┐
// │  PHASE 1  Input Guard    src/lib/guards/inputGuard.ts        │
// │  PHASE 2  LLM            Groq (llama-3.1-8b-instant)         │
// │  PHASE 3  Output Guard   src/lib/guards/outputGuard.ts       │
// │                                                              │
// │  Supporting modules:                                         │
// │    Fact Extraction       src/lib/extract.ts                  │
// │    Job Grounding         src/lib/jobSearch.ts                │
// └──────────────────────────────────────────────────────────────┘

import { NextRequest, NextResponse } from 'next/server';
import Groq                          from 'groq-sdk';
import { buildSystemPrompt }         from '@/lib/memory';
import { runInputGuard }             from '@/lib/guards/inputGuard';
import { runOutputGuard }            from '@/lib/guards/outputGuard';
import { runExtract }                from '@/lib/extract';
import { fetchJobPosting }           from '@/lib/jobSearch';
import type { PipelineStep, Message, UserProfile, JobContext } from '@/lib/types';

// ─── Rate limiter ─────────────────────────────────────────────────────────────
// 20 req/min per IP. In-memory only — resets on cold start.
// Swap in Upstash Redis for a persistent, multi-instance production limit.

const requestLog = new Map<string, number[]>();

const isRateLimited = (ip: string): boolean => {
  const now        = Date.now();
  const windowMs   = 60_000;
  const limit      = 20;
  const timestamps = (requestLog.get(ip) ?? []).filter(t => now - t < windowMs);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > limit;
};

// ─── Route handler ────────────────────────────────────────────────────────────

export const POST = async (req: NextRequest) => {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 },
    );
  }

  let body: { message: string; history: Message[]; profile: UserProfile; jobContext: JobContext | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { message, history, profile, jobContext: existingJobContext } = body;

  if (!message) {
    return NextResponse.json({ error: 'Missing message' }, { status: 400 });
  }

  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit     = (obj: object) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'));
      const emitStep = (step: PipelineStep) => emit({ type: 'step', step });

      try {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        // ══════════════════════════════════════════════════════════════════
        // PHASE 1 — INPUT GUARD  (+ fact extraction, both parallel)
        // ══════════════════════════════════════════════════════════════════

        const [extractResult, inputGuardResult] = await Promise.all([
          runExtract(groq, message),
          runInputGuard(groq, message, history),
        ]);

        const { detectedCompany, detectedRole, personalFacts } = extractResult;

        emitStep({
          id:     'intent',
          label:  'Intent Detection',
          status: 'done',
          detail: detectedCompany ? `Company detected: ${detectedCompany}` : 'General query',
        });

        emitStep({
          id:     'input-guard',
          label:  'Input Guard',
          status: 'done',
          detail: inputGuardResult.detail,
        });

        // ── Grounding: fetch real job posting if company was detected ──────
        let jobContext: JobContext | null = existingJobContext ?? null;

        if (jobContext) {
          emitStep({ id: 'job', label: 'JSearch API', status: 'done',    detail: `Using cached posting: ${jobContext.company}` });
        } else if (detectedCompany) {
          const fetched = await fetchJobPosting(detectedCompany, detectedRole ?? '');
          if (fetched) {
            jobContext = fetched;
            emitStep({ id: 'job', label: 'JSearch API', status: 'done',    detail: `${fetched.company} — ${fetched.role}` });
          } else {
            emitStep({ id: 'job', label: 'JSearch API', status: 'skipped', detail: 'No posting found' });
          }
        } else {
          emitStep({ id: 'job', label: 'JSearch API', status: 'skipped', detail: 'Not triggered' });
        }

        // ══════════════════════════════════════════════════════════════════
        // PHASE 2 — LLM
        // System prompt locks in identity, coaching rules, and job context.
        // ══════════════════════════════════════════════════════════════════

        const systemPrompt = buildSystemPrompt(profile, jobContext, inputGuardResult.caution);
        const replyResult  = await groq.chat.completions.create({
          model:       'llama-3.1-8b-instant',
          max_tokens:  400,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user',   content: message },
          ],
        });

        const reply = replyResult.choices[0].message.content ?? '';

        emitStep({
          id:     'groq',
          label:  'Groq LLM',
          status: 'done',
          detail: reply,
        });

        // ══════════════════════════════════════════════════════════════════
        // PHASE 3 — OUTPUT GUARD
        // Validates the reply before delivery. Blocked replies are replaced
        // with a safe fallback — the user never sees the original.
        // ══════════════════════════════════════════════════════════════════

        const outputGuardResult = await runOutputGuard(groq, reply, inputGuardResult.caution);

        emitStep({
          id:     'guardrail',
          label:  'Output Guard',
          status: 'done',
          detail: outputGuardResult.detail,
        });

        emit({
          type:       'done',
          reply:      outputGuardResult.finalReply,
          newFacts:   personalFacts,
          jobContext,
        });

      } catch (err: unknown) {
        console.error('Ask stream error:', err);
        emit({ type: 'error', message: 'Something went wrong.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':      'application/x-ndjson',
      'Cache-Control':     'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
};
