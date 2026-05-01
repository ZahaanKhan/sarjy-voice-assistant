// Shared TypeScript types used across the app.

// A single message in the conversation history
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// The user's remembered profile — stored in localStorage, injected into every prompt
export interface UserProfile {
  name?: string;
  city?: string;
  [key: string]: string | undefined; // allows any additional fact keys
}

// Job context fetched from JSearch when the user mentions a company
export interface JobContext {
  company:     string;
  role:        string;
  description: string;
}

// The four states the assistant cycles through
export type AssistantStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

// Pipeline step shown in the UI while a request is in flight
// Known step ids: 'transcript' | 'intent' | 'input-guard' | 'job' | 'groq' | 'guardrail'
export type StepStatus = 'waiting' | 'running' | 'done' | 'skipped';

export interface PipelineStep {
  id:      'transcript' | 'intent' | 'input-guard' | 'job' | 'groq' | 'guardrail' | string;
  label:   string;
  status:  StepStatus;
  detail?: string;
}
