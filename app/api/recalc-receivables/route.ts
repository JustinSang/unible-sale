export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchAll } from '@/lib/loadAll';
import { openingConfig } from '@/lib/receivables';
import { customerBalance, withOpening, dedupeSlips } from '@/lib/ledgerRules';
import { audit } from '@/lib/audit';

// 모든 거래처의 미수금 칸을 장부 잔액으로 다시 맞춘다(초기이월금을 넣은 직후·점검용). 장부 방식(기준일 설정)이 꺼져 있으면 아무것도 안 한다.
// dryRun:true 면 바뀔 건수·합계만 알려 준다.
export async function POST(req: Request) {
  try {
    const { dryRun } = await req.json().catch(() => ({}));
    const op = await openingConfig();
    if (!op) return NextResponse.json({ error: '초기이월금 기준일이 설정되어 있지 않습니다(거래처관리에서 먼저 입력하세요).' }, { status: 400 });
    const [slips, collections, customers] = await Promise.all([fetchAll('slips'), fetchAll('collections'), fetchAll('customers')]);
    const eff = withOpening(dedupeSlips(slips as any[]).slips, collections as any[], op);
    const changes: { id: string; name: string; from: number; to: number }[] = [];
    for (const c of customers as any[]) {
      const to = Math.round(customerBalance(eff.slips as any, eff.collections as any, c.id, eff.base.get(c.id) || 0));
      if (Math.round(Number(c.receivables) || 0) !== to) changes.push({ id: c.id, name: c.name, from: Number(c.receivables) || 0, to });
    }
    if (!dryRun) {
      for (let i = 0; i < changes.length; i += 25) {
        const rs = await Promise.all(changes.slice(i, i + 25).map(ch => supabase.from('customers').update({ receivables: ch.to }).eq('id', ch.id)));
        const bad = rs.find(r => r.error); if (bad?.error) throw new Error(bad.error.message);
      }
      await audit('update', 'customer', 'receivables-batch', `거래처 미수금을 장부 잔액으로 재계산: ${changes.length}곳`, { 기준일: op.asOf, 건수: changes.length, 예: changes.slice(0, 20) });
    }
    const sum = (f: (c: typeof changes[number]) => number) => changes.reduce((a, c) => a + f(c), 0);
    return NextResponse.json({ ok: true, dryRun: !!dryRun, 기준일: op.asOf, 엄격모드: !!op.strict, 바뀔거래처: changes.length, 변경전합계: sum(c => c.from), 변경후합계: sum(c => c.to), 예: changes.slice(0, 5) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '재계산 실패' }, { status: 500 });
  }
}
