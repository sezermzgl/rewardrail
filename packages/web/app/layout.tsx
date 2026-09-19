import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'RewardRail',
  description: 'A Stellar-based payout and settlement layer for rewarded advertising.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
