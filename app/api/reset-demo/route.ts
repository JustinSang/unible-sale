export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { resetDemoStore } from '@/lib/store';

export async function POST() {
  try {
    const state = resetDemoStore();
    return NextResponse.json({ success: true, data: state });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '데모 리셋 실패' }, { status: 500 });
  }
}
