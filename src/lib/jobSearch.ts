// JOB SEARCH MODULE — Grounding layer
//
// Fetches a real job posting from JSearch (RapidAPI) when the user mentions a company.
// This is the hallucination prevention layer: all company-specific context injected
// into the LLM prompt comes from this real posting, never from the model's training data.
//
// If no API key is set, or the search returns no results, the function returns null.
// The system prompt then instructs Sarjy to ask the user rather than guess.

import type { JobContext } from '@/lib/types';

export const fetchJobPosting = async (
  company: string,
  role:    string,
): Promise<JobContext | null> => {
  const key = process.env.JSEARCH_API_KEY;
  if (!key) return null;

  try {
    const query = `${company} ${role || 'software engineer'} jobs`;
    const url   = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=1&page=1`;

    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key':  key,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      data?: Array<{
        employer_name?:   string;
        job_title?:       string;
        job_description?: string;
      }>;
    };

    const job = data.data?.[0];
    if (!job) return null;

    return {
      company:     job.employer_name   ?? company,
      role:        job.job_title       ?? role,
      description: (job.job_description ?? '').slice(0, 2000), // cap prompt budget
    };
  } catch {
    return null;
  }
};
