// MEMORY MODULE
// Manages the user's profile and conversation history in localStorage.
//
// Two things are persisted:
//   1. User profile — a flat JSON object of facts ("city": "Austin", "name": "Zahaan")
//      Injected into every system prompt so the assistant always "knows" the user.
//   2. Conversation history — the last MAX_TURNS message pairs.
//      Sent with every request to maintain conversational context.
//
// The profile is bounded by the number of distinct facts, not conversation length.
// History is bounded by MAX_TURNS so token count never grows unbounded.

import type { Message, UserProfile } from '@/lib/types';

const PROFILE_KEY = 'sarjy_profile';
const HISTORY_KEY = 'sarjy_history';
const MAX_TURNS    = 10; // keep last 10 user+assistant pairs

// ─── Profile ──────────────────────────────────────────────────────────────────

export function getProfile(): UserProfile {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

// Merge new facts into the existing profile (new values overwrite old ones)
export function saveProfile(updates: Record<string, string>): void {
  const existing = getProfile();
  const merged   = { ...existing, ...updates };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
}

export function clearProfile(): void {
  localStorage.removeItem(PROFILE_KEY);
}

// ─── System Prompt ────────────────────────────────────────────────────────────

// Builds the system prompt that prefixes every Groq request.
// Accepts an explicit profile so it works server-side (where localStorage is unavailable).
// Falls back to reading localStorage when called from the browser.
export function buildSystemPrompt(weatherContext?: string, profileOverride?: UserProfile): string {
  const profile    = profileOverride ?? getProfile();
  const hasProfile = Object.keys(profile).length > 0;

  const profileSection = hasProfile
    ? `What you know about the user:\n${JSON.stringify(profile, null, 2)}`
    : "You don't know anything about the user yet. Learn their name and city naturally.";

  return [
    'You are Sarjy, a helpful voice assistant.',
    'Keep responses short and natural for speech — 1 to 3 sentences max.',
    'Do not use lists, markdown, or special characters — your response will be spoken aloud.',
    '',
    profileSection,
    '',
    weatherContext ? `Current weather data:\n${weatherContext}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
}

// ─── Conversation History ─────────────────────────────────────────────────────

export function getHistory(): Message[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
  } catch {
    return [];
  }
}

// Append a new user+assistant turn and trim to the rolling window
export function addToHistory(userMsg: string, assistantMsg: string): void {
  const history = getHistory();

  history.push({ role: 'user',      content: userMsg      });
  history.push({ role: 'assistant', content: assistantMsg });

  // Trim oldest messages first, keeping MAX_TURNS * 2 total (user + assistant pairs)
  const trimmed = history.slice(-MAX_TURNS * 2);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
