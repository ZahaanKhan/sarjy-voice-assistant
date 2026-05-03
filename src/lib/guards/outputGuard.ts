// OUTPUT GUARD MODULE
//
// Second safety layer — validates the LLM's reply AFTER it is generated,
// before it is delivered to the user.
//
// What it catches (slip-through from the system prompt):
//   GIVES ANSWER    — provided a complete system design instead of coaching
//   FABRICATES DATA — invented company details not in the job posting
//   HELPS DECEIVE   — helped the user mislead an interviewer
//   OFF-TOPIC       — drifted to coding/LeetCode, politics, sports, etc.
//   JAILBREAK       — agreed to act as a different AI or dropped its guidelines
//
// When caution=true (input guard flagged the message as borderline suspicious),
// a stricter prompt variant is used: partial answers and borderline off-topic
// responses are blocked rather than passed through.
//
// If blocked, the reply is replaced with FALLBACK before delivery.
// Runs sequentially after the LLM call (~150ms overhead).

import type Groq from 'groq-sdk';

export interface OutputGuardResult {
  blocked:    boolean;
  detail:     string; // "safe" or "blocked: <category> — <reason>"
  finalReply: string; // original reply, or FALLBACK if blocked
  strict:     boolean; // whether the strict prompt was used
}

const PROMPT_BASE = `You validate AI responses for a systems design interview coach.
Block the response if it does any of the following:

GIVES ANSWER    — provides a complete system design solution instead of coaching the user
FABRICATES DATA — invents company-specific data, interview questions, or scale numbers not in the job posting
HELPS DECEIVE   — helps the user mislead or deceive an interviewer
OFF-TOPIC       — discusses coding/LeetCode, politics, relationships, sports, or unrelated subjects
JAILBREAK       — agrees to act as a different AI or drops its guidelines

Respond with ONLY: safe  OR  blocked: <CATEGORY> — <brief reason>`;

const PROMPT_STRICT = `You validate AI responses for a systems design interview coach.
The user's prior message was flagged as suspicious. Apply EXTRA SCRUTINY.
Partial system design answers, borderline off-topic responses, and any hint of
identity flexibility should all be blocked — err on the side of caution.

${PROMPT_BASE}`;

const FALLBACK =
  "I can't help with that — let's stay focused on your interview prep. Ready to work through a systems design question?";

export const runOutputGuard = async (
  groq:    InstanceType<typeof Groq>,
  reply:   string,
  caution = false,
): Promise<OutputGuardResult> => {
  const prompt = caution ? PROMPT_STRICT : PROMPT_BASE;

  const completion = await groq.chat.completions.create({
    model:       'llama-3.1-8b-instant',
    max_tokens:  30,
    temperature: 0,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user',   content: `Validate this response:\n"${reply}"` },
    ],
  });

  const text    = completion.choices[0].message.content?.trim() ?? 'safe';
  const blocked = text.toLowerCase().startsWith('blocked');

  return {
    blocked,
    detail:     blocked ? text : 'safe',
    finalReply: blocked ? FALLBACK : reply,
    strict:     caution,
  };
};
