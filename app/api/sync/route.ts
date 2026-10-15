export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { loadAll } from '@/lib/loadAll';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();

    if (body.manualTrigger) {
      return NextResponse.json({ success: true, serverTimestamp: now, data: await loadAll() });
    }
    return NextResponse.json({ success: true, serverTimestamp: now });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '동기화 오류' }, { status: 500 });
  }
}
