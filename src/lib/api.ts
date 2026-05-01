// API CLIENT
// The frontend has a single function: ask().
// All orchestration (intent detection, job posting lookup, Groq, guardrail)
// happens server-side in /api/ask. Adding a new intent never requires
// a frontend change — just add a branch in the route.

import type { Message, UserProfile, PipelineStep, JobContext } from '@/lib/types';

export interface AskResponse {
  reply:       string;
  pipeline:    PipelineStep[];
  newFacts:    Record<string, string>;
  jobContext:  JobContext | null;
}

// Send a user message to the orchestrator endpoint.
// Returns the reply, the full pipeline trace, any newly extracted facts,
// and the job context (if a company was detected this turn).
export const ask = async (
  message:    string,
  history:    Message[],
  profile:    UserProfile,
  jobContext: JobContext | null,
): Promise<AskResponse> => {
  const res = await fetch('/api/ask', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ message, history, profile, jobContext }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<AskResponse>;
};
