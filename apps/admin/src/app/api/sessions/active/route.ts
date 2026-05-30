import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM sessions WHERE status IN ('active', 'starting')`,
    );
    const activeUserIds = result.rows.map((r) => r.user_id);
    return NextResponse.json({ activeUserIds });
  } catch {
    // Sessions table may not exist yet — return empty list
    return NextResponse.json({ activeUserIds: [] });
  }
}
