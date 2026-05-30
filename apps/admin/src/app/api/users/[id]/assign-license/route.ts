/**
 * POST /api/users/[id]/assign-license
 * Calls the KeyAuth Seller API to generate a RogueZero license key,
 * stores it against the user, sets expiry date, and enables access.
 */
import { NextRequest, NextResponse } from 'next/server';
import { usersTableReady, getUserById, assignLicense } from '@/lib/db';
import { generateLicense, expiryDateFromDuration } from '@/lib/keyauth';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await usersTableReady();

    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const duration = user.duration ?? '1month';
    const licenseKey = await generateLicense(duration);
    const expiryDate = expiryDateFromDuration(duration);
    const updated = await assignLicense(id, licenseKey, expiryDate);

    return NextResponse.json({ success: true, user: updated });
  } catch (err) {
    console.error('[POST /api/users/[id]/assign-license]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
