import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title:       'Sarjy — Voice Assistant',
  description: 'Sarjy — an AI systems design interview coach with guardrails and job posting grounding.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
