import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title:       'Sarjy — Voice Assistant',
  description: 'A voice assistant with cross-session memory and live weather data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
