// VOICE INPUT
// Wraps the browser's Web Speech API (SpeechRecognition).
// Chrome-only — Firefox and Safari do not support this API.
//
// Supports two result callbacks:
//   onInterim — fires continuously as the user speaks (live preview)
//   onResult  — fires once with the final, committed transcript

export function startListening(
  onResult:  (transcript: string) => void,
  onError:   (message: string)    => void,
  onInterim?: (transcript: string) => void,
): () => void {
  const SpeechRecognition =
    (window as any).SpeechRecognition ??
    (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError('Speech recognition is not supported. Please use Chrome.');
    return () => {};
  }

  const recognition = new SpeechRecognition();
  recognition.lang           = 'en-US';
  recognition.continuous     = false;
  recognition.interimResults = !!onInterim; // only enable if caller wants live preview

  recognition.onresult = (event: any) => {
    const result     = event.results[event.results.length - 1];
    const transcript = (result[0].transcript as string).trim();

    if (result.isFinal) {
      onResult(transcript);
    } else {
      onInterim?.(transcript);
    }
  };

  let retries = 0;

  const start = () => recognition.start();

  recognition.onerror = (event: any) => {
    if (event.error === 'aborted') return;

    // "network" fires when Chrome's speech servers are temporarily unreachable.
    // A single retry after a short delay fixes it in most cases.
    if (event.error === 'network' && retries < 2) {
      retries++;
      setTimeout(start, 800);
      return;
    }

    const messages: Record<string, string> = {
      network:       'Could not reach speech servers. Check your connection and try again.',
      'not-allowed': 'Microphone permission was denied. Allow mic access in Chrome settings.',
      'no-speech':   'No speech detected. Please try again.',
    };
    onError(messages[event.error as string] ?? `Mic error: ${event.error}`);
  };

  start();
  return () => recognition.stop();
}
