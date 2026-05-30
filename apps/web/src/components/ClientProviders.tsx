'use client';

import dynamic from 'next/dynamic';

const RZWalletProvider = dynamic(
  () => import('./WalletProvider').then((m) => m.RZWalletProvider),
  { ssr: false }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <RZWalletProvider>{children}</RZWalletProvider>;
}
