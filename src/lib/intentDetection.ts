// INTENT DETECTION
// Determines whether a user message requires a weather API call.
//
// Strategy: keyword match + question signal (two-gate approach).
// A message must contain both a weather word AND a question signal to trigger.
// This avoids false positives like "I love sunny days" while catching
// natural queries like "will it rain tomorrow?" or "is it cold outside?".
//
// Trade-off: misses very indirect phrasing. For production, replace with
// a GPT classifier call — but that adds ~400ms per message.

const WEATHER_TRIGGERS = [
  'weather', 'temperature', 'forecast',
  'rain', 'raining', 'snow', 'snowing', 'sunny', 'cloudy', 'overcast',
  'cold', 'hot', 'warm', 'humid', 'wind', 'windy', 'storm',
  'outside', 'degrees', 'celsius', 'fahrenheit',
];

// A question signal prevents firing on statements like "I love sunny weather"
const QUESTION_SIGNALS = [
  'is', 'will', 'what', 'how', 'should', 'can', 'do', '?',
];

export function isWeatherQuery(text: string): boolean {
  const lower = text.toLowerCase();
  const hasWeatherWord = WEATHER_TRIGGERS.some(w => lower.includes(w));
  const hasQuestion    = QUESTION_SIGNALS.some(q => lower.includes(q));
  return hasWeatherWord && hasQuestion;
}
