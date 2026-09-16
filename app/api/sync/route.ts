import { NextResponse } from 'next/server';
import { loadStore, saveStore } from '@/lib/store';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const store = loadStore();
    const now = new Date().toISOString();
    store.config.lastSyncTime = now;
    saveStore(store);

    if (body.manualTrigger) {
      return NextResponse.json({
        success: true,
        serverTimestamp: now,
        data: store
      });
    }

    return NextResponse.json({
      success: true,
      serverTimestamp: now
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '동기화 오류' }, { status: 500 });
  }
}
