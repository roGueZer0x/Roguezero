/**
 * PATCH  /api/users/[id]  — toggle trading access on or off for a user
 * DELETE /api/users/[id]  — permanently remove a user from the admin list
 */
import { NextRequest, NextResponse } from 'next/server';
import { toggleAccess, deleteUser } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { accessEnabled } = await req.json() as { accessEnabled: boolean };
    const user = await toggleAccess(id, accessEnabled);
    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error('[PATCH /api/users/[id]]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/users/[id]]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
