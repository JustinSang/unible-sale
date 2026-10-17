export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchAll } from '@/lib/loadAll';
import { recalcStock } from '@/lib/stockRecalc';
import { audit } from '@/lib/audit';

// 재고 재계산 점검·보정(원본 «자료 보정·점검»의 재고 부분).
// mode 'preview' = 전표로 다시 센 재고와 현재고가 다른 품목 목록(쓰기 없음).
// mode 'apply'   = 고른 품목(productIds)만 다시 센 값으로 맞춘다. 기대값은 요청 시점에 서버가 다시 계산한다(화면이 보낸 값은 믿지 않는다). 재고 기록·변경 이력을 남긴다.
export async function POST(req: Request) {
  try {
    const { mode, productIds, reason } = await req.json();
    if (mode !== 'preview' && mode !== 'apply') return NextResponse.json({ error: 'mode는 preview 또는 apply 입니다.' }, { status: 400 });
    const [products, slips] = await Promise.all([fetchAll('products'), fetchAll('slips')]);
    const r = recalcStock(products as any[], slips as any[]);
    if (mode === 'preview') return NextResponse.json({ ok: true, 검사품목: r.checked, 일치: r.matched, 불일치: r.diffs.length, 전표없음: r.diffs.filter(d => d.kind === 'noSlips').length, 이관소문자전표_계산제외: r.legacySlips, diffs: r.diffs });

    if (!Array.isArray(productIds) || productIds.length === 0) return NextResponse.json({ error: '보정할 품목을 고르세요.' }, { status: 400 });
    const want = new Set<string>(productIds.map(String));
    const targets = r.diffs.filter(d => want.has(d.id));
    const now = new Date();
    const why = String(reason || '').slice(0, 100) || `재고 재계산 보정 (${now.toISOString().slice(0, 10)})`;
    let done = 0;
    for (const d of targets) {
      const { error } = await supabase.from('products').update({ currentStock: d.expected }).eq('id', d.id);
      if (error) throw new Error(`${d.name}: ${error.message}`);
      const { error: logErr } = await supabase.from('inventory_logs').insert({
        id: `il-${Date.now()}-${done}`, date: now.toISOString().slice(0, 10), productId: d.id, productName: d.name, spec: d.spec,
        changeType: d.expected >= d.current ? 'adjust_plus' : 'adjust_minus', changeQty: Math.abs(d.expected - d.current),
        beforeQty: d.current, afterQty: d.expected, reason: `재고 재계산 보정: 전표 기준 ${d.expected} (이월 ${d.opening} + 전표 ${d.moved}) — ${why}`, createdAt: now.toISOString()
      });
      if (logErr) console.error('inventory_logs insert failed:', logErr.message);
      done++;
    }
    await audit('update', 'stock', 'recalc-batch', `재고 재계산 보정: ${done}개 품목(요청 ${want.size}개 중 불일치가 남아 있던 것만)`, { 사유: why, 품목: targets.slice(0, 50).map(d => ({ id: d.id, name: d.name, from: d.current, to: d.expected })) });
    return NextResponse.json({ ok: true, 요청: want.size, 보정: done, 이미_일치하거나_없음: want.size - done });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '재고 재계산 실패' }, { status: 500 });
  }
}
