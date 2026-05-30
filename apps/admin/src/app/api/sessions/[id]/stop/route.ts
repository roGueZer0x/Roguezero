/**
 * POST /api/sessions/[id]/stop — admin force-stop a session
 */
import { NextRequest, NextResponse } from 'next/server';
import { forceStopSession } from '@/lib/db';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await forceStopSession(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found or already stopped' }, { status: 404 });
    }
    return NextResponse.json({ success: true, session });
  } catch (err) {
    console.error('[POST /api/sessions/[id]/stop]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
