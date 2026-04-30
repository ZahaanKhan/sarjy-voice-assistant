// VOICE OUTPUT
// Wraps the browser's SpeechSynthesis API for text-to-speech.
// Available in all modern browsers — no API key, no cost, no latency.
// Trade-off: robotic voice quality vs ElevenLabs/OpenAI TTS (which add ~300ms + cost).

export function speak(text: string, onEnd?: () => void): void {
  // Always cancel any in-progress speech before starting new — avoids overlap
  window.speechSynthesis.cancel();

  const utterance     = new SpeechSynthesisUtterance(text);
  utterance.lang      = 'en-US';
  utterance.rate      = 1.05;  // slightly faster than default — feels more natural
  utterance.pitch     = 1.0;
  utterance.volume    = 1.0;

  if (onEnd) utterance.onend = onEnd;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  window.speechSynthesis.cancel();
}
