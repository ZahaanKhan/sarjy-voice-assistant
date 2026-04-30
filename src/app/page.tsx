'use client';

import { useState, useCallback, useEffect } from 'react';
import type { AssistantStatus, Message, PipelineStep } from '@/lib/types';
import {
  getHistory, addToHistory,
  getProfile, saveProfile, clearProfile, clearHistory,
} from '@/lib/memory';
import { startListening }      from '@/lib/voiceInput';
import { speak, stopSpeaking } from '@/lib/voiceOutput';
import { ask }                 from '@/lib/api';
import PipelineRow             from '@/components/PipelineRow';
import MicIcon                 from '@/components/icons/MicIcon';

// The transcript step is always the first — handled by the browser's Speech API.
// The remaining three steps are returned by the /api/ask orchestrator.
const INITIAL_STEPS: PipelineStep[] = [
  { id: 'transcript', label: 'Transcribing',      status: 'waiting' },
  { id: 'intent',     label: 'Intent Detection',  status: 'waiting' },
  { id: 'weather',    label: 'OpenWeatherMap API', status: 'waiting' },
  { id: 'groq',       label: 'Groq (LLM)',         status: 'waiting' },
];

// While /api/ask is running, show all three server steps as "running"
// so the user sees immediate feedback even before the response arrives.
const PENDING_SERVER_STEPS: PipelineStep[] = [
  { id: 'intent',  label: 'Intent Detection',  status: 'running' },
  { id: 'weather', label: 'OpenWeatherMap API', status: 'running' },
  { id: 'groq',    label: 'Groq (LLM)',         status: 'running' },
];

const STATUS_LABELS: Record<AssistantStatus, string> = {
  idle:      'Tap to speak',
  listening: 'Listening...',
  thinking:  'Thinking...',
  speaking:  'Speaking — tap to stop',
};

const Home = () => {
  const [status,  setStatus]  = useState<AssistantStatus>('idle');
  const [steps,   setSteps]   = useState<PipelineStep[]>(INITIAL_STEPS);
  const [reply,   setReply]   = useState('');
  const [error,   setError]   = useState('');
  // Initialize after mount so localStorage isn't accessed during SSR
  const [profile, setProfile] = useState<ReturnType<typeof getProfile>>({});
  useEffect(() => { setProfile(getProfile()); }, []);

  // Replace steps by id — used to merge server pipeline results into state
  const mergeSteps = useCallback((incoming: PipelineStep[]) => {
    setSteps(prev =>
      prev.map(s => incoming.find(i => i.id === s.id) ?? s),
    );
  }, []);

  // ─── Main voice loop ────────────────────────────────────────────────────

  const handleMicClick = useCallback(async () => {
    if (status === 'speaking') {
      stopSpeaking();
      setStatus('idle');
      return;
    }

    setError('');
    setReply('');
    setSteps(INITIAL_STEPS);
    setStatus('listening');

    // Mark transcription as in-progress immediately
    setSteps(prev => prev.map(s =>
      s.id === 'transcript' ? { ...s, status: 'running' } : s,
    ));

    startListening(
      // onResult — final committed transcript
      async (userText) => {
        // Transcript done; show server steps as "running" while /api/ask is in flight
        setSteps(prev => [
          ...prev.map(s => s.id === 'transcript' ? { ...s, status: 'done' as const, detail: userText } : s),
          ...PENDING_SERVER_STEPS,
        ].filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i));

        setStatus('thinking');

        try {
          // Single request — backend handles intent, weather, Groq, fact extraction
          const history  = getHistory() as Message[];
          const current  = getProfile();
          const response = await ask(userText, history, current);

          // Replace pending server steps with the actual results
          mergeSteps(response.pipeline);
          setReply(response.reply);

          // Speak the reply
          setStatus('speaking');
          speak(response.reply, () => setStatus('idle'));

          // Persist history
          addToHistory(userText, response.reply);

          // Merge any new facts into the profile
          if (Object.keys(response.newFacts).length > 0) {
            saveProfile(response.newFacts);
            setProfile(getProfile());
          }
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
          setStatus('idle');
        }
      },

      // onError
      (errMsg) => {
        setError(errMsg);
        setStatus('idle');
      },

      // onInterim — live transcript preview while the user is still speaking
      (interim) => {
        setSteps(prev => prev.map(s =>
          s.id === 'transcript' ? { ...s, status: 'running', detail: interim } : s,
        ));
      },
    );
  }, [status, mergeSteps]);

  const handleReset = () => {
    clearProfile();
    clearHistory();
    setProfile({});
    setSteps(INITIAL_STEPS);
    setReply('');
    setError('');
    setStatus('idle');
  };

  const anyStepStarted = steps.some(s => s.status !== 'waiting');
  const profileKeys    = Object.keys(profile);

  return (
    <div className="app">
      <header className="header">
        <span className="logo">Sarjy v5</span>
        <span className="subtitle">Voice Assistant</span>
      </header>

      <div className="mic-area">
        <button
          className={`mic-btn mic-btn--${status}`}
          onClick={handleMicClick}
          aria-label={STATUS_LABELS[status]}
        >
          <MicIcon status={status} />
        </button>
        <p className="status-label">{STATUS_LABELS[status]}</p>
      </div>

      {anyStepStarted && (
        <div className="pipeline">
          {steps.map((step) => (
            <PipelineRow key={step.id} step={step} />
          ))}
        </div>
      )}

      {reply && (
        <div className="bubble bubble--sarjy">
          <span className="bubble-label">Sarjy says</span>
          <p>{reply}</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="profile-card">
        <span className="profile-title">What Sarjy remembers</span>
        {profileKeys.length > 0 ? (
          <ul className="profile-list">
            {profileKeys.map((key) => (
              <li key={key}>
                <span className="profile-key">{key}</span>
                <span className="profile-val">{profile[key]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="profile-empty">Nothing yet — try saying your name or city.</p>
        )}
        <button className="reset-btn" onClick={handleReset} disabled={profileKeys.length === 0}>
          Forget everything
        </button>
      </div>

      <p className="footer-note">Works in Chrome only · Uses microphone</p>
    </div>
  );
};

export default Home;
