// API CLIENT — streaming
//
// ask() opens an NDJSON stream to /api/ask and processes events as they arrive.
// Each pipeline step is delivered to the caller via onStep() the moment the
// server completes it, so the UI can update each row live rather than all at once.
//
// Wire protocol (one JSON object per line):
//   { type: "step", step: PipelineStep }       — one row completed
//   { type: "done", reply, newFacts, jobContext } — final payload
//   { type: "error", message }                 — server error

import type { Message, UserProfile, PipelineStep, JobContext } from '@/lib/types';

export interface AskResult {
  reply:      string;
  newFacts:   Record<string, string>;
  jobContext: JobContext | null;
}

export const ask = async (
  message:    string,
  history:    Message[],
  profile:    UserProfile,
  jobContext: JobContext | null,
  onStep:     (step: PipelineStep) => void,
): Promise<AskResult> => {
  const res = await fetch('/api/ask', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message, history, profile, jobContext }),
  });

  // Non-2xx before the stream even starts (rate limit, bad request, etc.)
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }

  const reader  = res.body!.getReader();
  const decoder = new TextDecoder();
  let   buffer  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Accumulate incoming bytes; split on newlines to get complete JSON lines
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // keep any incomplete trailing line for next chunk

    for (const line of lines) {
      if (!line.trim()) continue;

      let event: { type: string; [key: string]: unknown };
      try {
        event = JSON.parse(line);
      } catch {
        continue; // skip malformed lines
      }

      if (event.type === 'step') {
        onStep(event.step as PipelineStep);
      } else if (event.type === 'done') {
        return {
          reply:      event.reply      as string,
          newFacts:   event.newFacts   as Record<string, string>,
          jobContext: event.jobContext  as JobContext | null,
        };
      } else if (event.type === 'error') {
        throw new Error(event.message as string);
      }
    }
  }

  throw new Error('Stream closed before completion.');
};
