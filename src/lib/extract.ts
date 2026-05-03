// FACT EXTRACTION MODULE
//
// Extracts two things from the user's message in a single Groq call:
//   1. Personal facts  — name, city, etc. → saved to the user's profile
//   2. Intent signals  — _company, _role  → used to trigger the JSearch lookup
//
// Runs in parallel with the Input Guard so it adds zero latency.

import type Groq from 'groq-sdk';

export interface ExtractResult {
  detectedCompany?: string;
  detectedRole?:    string;
  personalFacts:    Record<string, string>;
}

const PROMPT = `You extract facts from user messages. Respond with ONLY a JSON object. No explanation, no markdown.
Use camelCase keys for personal facts (name, city, etc).
Also include "_company" if the user mentions a company they are interviewing with.
Also include "_role" if the user mentions a job title or role they are targeting.
Return {} if nothing applies.`;

// Extracts the first {...} block from a model response.
// Needed because Llama occasionally wraps JSON in markdown fences.
const parseJSON = (raw: string): Record<string, string> => {
  try {
    const stripped = raw.replace(/```(?:json)?|```/g, '').trim();
    const match    = stripped.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  } catch {
    return {};
  }
};

export const runExtract = async (
  groq:    InstanceType<typeof Groq>,
  message: string,
): Promise<ExtractResult> => {
  const completion = await groq.chat.completions.create({
    model:       'llama-3.1-8b-instant',
    max_tokens:  150,
    temperature: 0,
    messages: [
      { role: 'system', content: PROMPT },
      { role: 'user',   content: `Message: "${message}"` },
    ],
  });

  const extracted = parseJSON(completion.choices[0].message.content ?? '{}');

  // Pull out routing keys before saving to profile
  const { _company: detectedCompany, _role: detectedRole, ...personalFacts } = extracted;

  return {
    detectedCompany: detectedCompany || undefined,
    detectedRole:    detectedRole    || undefined,
    personalFacts,
  };
};
