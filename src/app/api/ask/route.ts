// ORCHESTRATOR ENDPOINT
// Single entry point for every user message. Runs the full pipeline server-side:
//
//   1. Intent detection  — decides which external APIs to call
//   2. Weather fetch     — only if intent fires (OpenWeatherMap)
//   3. Groq              — builds prompt with context and calls the LLM
//   4. Fact extraction   — extracts new user facts from the exchange
//
// Adding a new intent (calendar, maps, transit) means adding a branch here —
// the frontend never needs to change.

import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { isWeatherQuery }      from '@/lib/intentDetection';
import { buildSystemPrompt }   from '@/lib/memory';
import { formatWeatherContext } from '@/lib/api';
import type { PipelineStep, Message, UserProfile } from '@/lib/types';

// Rate limiter — 20 req/min per IP (Groq free tier cap is 30)
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

// ─── Weather helper ───────────────────────────────────────────────────────────

const fetchWeatherData = async (city: string) => {
  const key = process.env.WEATHER_API_KEY;
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${key}&units=imperial`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`);
  return res.json();
};

// ─── Fact extraction helper ───────────────────────────────────────────────────

const extractFactsFromExchange = async (
  groq:           Groq,
  userMessage:    string,
  assistantReply: string,
): Promise<Record<string, string>> => {
  try {
    const completion = await groq.chat.completions.create({
      model:       'llama-3.1-8b-instant',
      max_tokens:  100,
      temperature: 0,
      messages: [
        {
          role:    'system',
          content: 'Extract any new personal facts about the user. Return flat JSON with camelCase keys or {}. Only include facts explicitly stated.',
        },
        {
          role:    'user',
          content: `User: "${userMessage}"\nAssistant: "${assistantReply}"`,
        },
      ],
    });

    const raw = completion.choices[0].message.content ?? '{}';
    console.log('[extractFacts] raw model output:', raw);

    // Strip markdown fences, then extract the first {...} block in the response
    const stripped = raw.replace(/```(?:json)?|```/g, '').trim();
    const match    = stripped.match(/\{[\s\S]*\}/);
    const result   = match ? JSON.parse(match[0]) : {};
    console.log('[extractFacts] parsed:', result);
    return result;
  } catch {
    return {};
  }
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

  try {
    const { message, history, profile } = await req.json() as {
      message: string;
      history: Message[];
      profile: UserProfile;
    };

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const groq     = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const pipeline: PipelineStep[] = [];

    // ── Step 1: Intent detection ─────────────────────────────────────────────
    const weatherNeeded = isWeatherQuery(message);
    pipeline.push({
      id:     'intent',
      label:  'Intent Detection',
      status: 'done',
      detail: weatherNeeded ? 'Weather query detected' : 'General query',
    });

    // ── Step 2: Weather API (conditional) ───────────────────────────────────
    let weatherContext: string | undefined;

    if (weatherNeeded) {
      const city = profile.city ?? 'New York';
      try {
        const weatherData  = await fetchWeatherData(city);
        weatherContext     = formatWeatherContext(weatherData);
        pipeline.push({
          id:     'weather',
          label:  'OpenWeatherMap API',
          status: 'done',
          detail: `${Math.round(weatherData.main.temp)}°F · ${weatherData.weather[0]?.description} · ${weatherData.name}`,
        });
      } catch {
        pipeline.push({
          id:     'weather',
          label:  'OpenWeatherMap API',
          status: 'skipped',
          detail: 'Weather fetch failed — answering without live data',
        });
      }
    } else {
      pipeline.push({
        id:     'weather',
        label:  'OpenWeatherMap API',
        status: 'skipped',
        detail: 'Not a weather query',
      });
    }

    // ── Step 3: Groq ─────────────────────────────────────────────────────────
    // Pass profile explicitly — localStorage is unavailable server-side
    const systemPrompt = buildSystemPrompt(weatherContext, profile);

    const completion = await groq.chat.completions.create({
      model:       'llama-3.1-8b-instant',
      max_tokens:  300,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user',   content: message },
      ],
    });

    const reply = completion.choices[0].message.content ?? '';
    pipeline.push({
      id:     'groq',
      label:  'Groq (LLM)',
      status: 'done',
      detail: reply,
    });

    // ── Step 4: Fact extraction (fire alongside response) ────────────────────
    const newFacts = await extractFactsFromExchange(groq, message, reply);

    return NextResponse.json({ reply, pipeline, newFacts });
  } catch (err: unknown) {
    console.error('Ask route error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
};
