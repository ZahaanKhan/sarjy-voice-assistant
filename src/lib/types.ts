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

// The four states the assistant cycles through
export type AssistantStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

// OpenWeatherMap response shape (only the fields we use)
export interface WeatherData {
  name: string;
  main: { temp: number; humidity: number };
  weather: Array<{ description: string }>;
  wind: { speed: number };
}

// Pipeline step shown in the UI while a request is in flight
export type StepStatus = 'waiting' | 'running' | 'done' | 'skipped';

export interface PipelineStep {
  id:      string;
  label:   string;
  status:  StepStatus;
  detail?: string;
}
