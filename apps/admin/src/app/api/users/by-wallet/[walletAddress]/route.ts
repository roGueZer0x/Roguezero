/**
 * GET /api/users/by-wallet/[walletAddress]
 * Internal-only endpoint called by services/api when a user connects their wallet.
 * Returns the user's license and access status so trading can be gated.
 * Requires header: x-rz-internal-secret
 */
import { NextRequest, NextResponse } from 'next/server';
import { usersTableReady, getUserByWallet } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ walletAddress: string }> }
) {
  // Validate internal secret so only services/api can call this
  const secret = req.headers.get('x-rz-internal-secret');
  if (!secret || secret !== process.env.RZ_INTERNAL_SECRET) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { walletAddress } = await params;
    await usersTableReady();

    const user = await getUserByWallet(walletAddress);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'WALLET_NOT_FOUND' },
        { status: 404 }
      );
    }

    if (!user.access_enabled) {
      return NextResponse.json(
        { success: false, error: 'ACCESS_DISABLED' },
        { status: 403 }
      );
    }

    if (user.expiry_date && new Date(user.expiry_date) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'LICENSE_EXPIRED' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        walletAddress: user.wallet_address,
        licenseKey: user.license_key,
        expiryDate: user.expiry_date,
        accessEnabled: user.access_enabled,
      },
    });
  } catch (err) {
    console.error('[GET /api/users/by-wallet/[walletAddress]]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
