export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { fetchAll } from '@/lib/loadAll';

// 미동이엔씨 파트너 포털 자재마감 품목 내역(발주·입고 줄) — 탭을 열 때만 읽는다(수만 줄이라 init-data에는 싣지 않는다).
export async function GET() {
  try {
    const rows = await fetchAll('midong_orders', 'closeYm');
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '미동 발주내역을 읽지 못했습니다.' }, { status: 500 });
  }
}
