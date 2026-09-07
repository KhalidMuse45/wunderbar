import type { Metadata } from 'next';
import { Archivo, Lora, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
const display = Archivo({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Lora({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-body',
  display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});
export const metadata: Metadata = {
  title: { default: 'Wunderbar — Good Things Take Practice', template: '%s · Wunderbar' },
  description:
    'Practice behavioral interviews with a peer. Find your words, get thoughtful feedback, and build the confidence to be yourself.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
