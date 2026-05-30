/**
 * GET /api/sessions — list active/pending sessions for admin monitoring
 */
import { NextResponse } from 'next/server';
import { listActiveSessions } from '@/lib/db';

export async function GET() {
  try {
    const sessions = await listActiveSessions();
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error('[GET /api/sessions]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
