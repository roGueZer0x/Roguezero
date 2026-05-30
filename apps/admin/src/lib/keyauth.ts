const SELLER_KEY = process.env.KEYAUTH_SELLER_KEY ?? '';
const LICENSE_MASK = 'RogueZero-***-*-****-*';

const DURATION_DAYS: Record<string, number> = {
  '1month': 30,
  '6months': 180,
  '1year': 365,
};

export async function generateLicense(duration: string): Promise<string> {
  if (!SELLER_KEY) throw new Error('KEYAUTH_SELLER_KEY is not set');

  const days = DURATION_DAYS[duration] ?? 30;
  const url = new URL('https://keyauth.win/api/seller/');
  url.searchParams.set('sellerkey', SELLER_KEY);
  url.searchParams.set('type', 'add');
  url.searchParams.set('format', 'TXT');
  url.searchParams.set('expiry', days.toString());
  url.searchParams.set('mask', LICENSE_MASK);
  url.searchParams.set('amount', '1');

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`KeyAuth Seller API error: ${res.status} ${res.statusText}`);
  }

  const text = (await res.text()).trim();

  // Try JSON first (KeyAuth sometimes returns JSON even for TXT format)
  try {
    const json = JSON.parse(text) as { success?: boolean; key?: string; message?: string };
    if (json.success && json.key) return json.key;
    throw new Error(`KeyAuth returned failure: ${json.message ?? text}`);
  } catch {
    // Not JSON or already threw above — fall through to text parse
  }

  // Plain text — key starts with RogueZero
  const key = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('RogueZero'));
  if (key) return key;

  throw new Error(`Could not parse license key from KeyAuth response: ${text}`);
}

export function expiryDateFromDuration(duration: string): Date {
  const days = DURATION_DAYS[duration] ?? 30;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}
