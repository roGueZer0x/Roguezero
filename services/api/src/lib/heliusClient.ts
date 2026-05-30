import { createHelius } from 'helius-sdk';

const getHeliusNetwork = (): 'mainnet' | 'devnet' =>
  process.env.SOLANA_NETWORK === 'devnet' ? 'devnet' : 'mainnet';

let heliusClient: ReturnType<typeof createHelius> | null = null;

export const getHeliusClient = () => {
  const apiKey = process.env.HELIUS_API_KEY;

  if (!apiKey) {
    throw new Error('HELIUS_API_KEY is required for helius-sdk usage');
  }

  if (!heliusClient) {
    heliusClient = createHelius({
      apiKey,
      network: getHeliusNetwork(),
      userAgent: 'roguezero-api/0.1.0',
    });
  }

  return heliusClient;
};
