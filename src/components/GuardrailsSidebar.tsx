'use client';

const PROHIBITED_TOPICS = [
  'Giving away complete answers',
  'Fabricating company or interview data',
  'Helping users deceive interviewers',
  'Coding / LeetCode questions',
  'Off-topic conversations',
  'Identity override or jailbreak attempts',
  'Hate speech or discrimination',
];

const WarnIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ flexShrink: 0, marginTop: 2 }}
  >
    <path
      d="M6 1L11 10H1L6 1Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <line x1="6" y1="4.5" x2="6" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="6" cy="8.5" r="0.6" fill="currentColor" />
  </svg>
);

const GuardrailsSidebar = () => (
  <aside className="guardrails-sidebar">
    <div className="sidebar-heading">
      <span className="sidebar-title">How Sarjy Protects You</span>
      <span className="sidebar-subtitle">3 layers of guardrails are active on every message</span>
    </div>

    <div className="sidebar-layer">
      <span className="layer-badge">Layer 1 — System Prompt</span>
      <span className="layer-label">Identity &amp; Rules</span>
      <p className="layer-desc">
        Sarjy&apos;s personality, purpose, and prohibited topics are locked into every request. It cannot be renamed, jailbroken, or asked to act as a different AI.
      </p>
      <ul className="prohibited-list">
        {PROHIBITED_TOPICS.map(topic => (
          <li key={topic} className="prohibited-item">
            <WarnIcon />
            {topic}
          </li>
        ))}
      </ul>
    </div>

    <div className="sidebar-layer">
      <span className="layer-badge">Layer 2 — External API + Grounding</span>
      <span className="layer-label">Job Posting Grounding</span>
      <p className="layer-desc">
        When you mention a company, Sarjy fetches the real job posting via JSearch API. All company-specific context comes from that posting — never from the model&apos;s memory. If no posting is found, Sarjy asks you instead of guessing.
      </p>
    </div>

    <div className="sidebar-layer">
      <span className="layer-badge">Layer 3 — Guardrail Validator</span>
      <span className="layer-label">LLM Output Validation</span>
      <p className="layer-desc">
        Before every response reaches you, a second LLM call reviews Sarjy&apos;s output and checks it against the rules. If a violation is detected, the response is blocked and replaced with a safe fallback.
      </p>
    </div>
  </aside>
);

export default GuardrailsSidebar;
