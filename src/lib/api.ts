// API CLIENT
// The frontend has a single function: ask().
// All orchestration (intent detection, weather, Groq, fact extraction)
// happens server-side in /api/ask. Adding a new intent never requires
// a frontend change — just add a branch in the route.

import type { Message, UserProfile, PipelineStep } from '@/lib/types';

export interface AskResponse {
  reply:    string;
  pipeline: PipelineStep[];
  newFacts: Record<string, string>;
}

// Send a user message to the orchestrator endpoint.
// Returns the reply, the full pipeline trace, and any newly extracted facts.
export const ask = async (
  message: string,
  history: Message[],
  profile: UserProfile,
): Promise<AskResponse> => {
  const res = await fetch('/api/ask', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message, history, profile }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<AskResponse>;
};

// Formats raw OpenWeatherMap JSON into a short readable string.
// Used by the server-side route to inject weather context into the prompt.
export const formatWeatherContext = (data: {
  name: string;
  main: { temp: number; humidity: number };
  weather: Array<{ description: string }>;
  wind: { speed: number };
}): string =>
  [
    `Location:    ${data.name}`,
    `Temperature: ${Math.round(data.main.temp)}°F`,
    `Conditions:  ${data.weather[0]?.description ?? 'unknown'}`,
    `Humidity:    ${data.main.humidity}%`,
    `Wind:        ${Math.round(data.wind.speed)} mph`,
  ].join('\n');
