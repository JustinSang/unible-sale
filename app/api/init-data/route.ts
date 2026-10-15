export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { loadAll } from '@/lib/loadAll';

export async function GET() {
  try {
    return NextResponse.json(await loadAll());
  } catch (error: any) {
    console.error('Data Fetch Error:', error);
    return NextResponse.json({ error: error.message || '데이터 로드 실패' }, { status: 500 });
  }
}
