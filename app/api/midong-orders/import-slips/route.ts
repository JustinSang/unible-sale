export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { fetchAll } from '@/lib/loadAll';

// 미동 발주내역(청구번호 단위)을 «수주(CONTRACT) 전표»로 가져온다.
// - 수주 전표는 외상미수금·재고에 영향이 없다(납품·매출 전환은 기존 «납품서로 변환» 흐름).
// - 전표 번호표(id)가 청구번호로 정해져 있어 다시 눌러도 중복되지 않고, 이미 있는 전표(고친 것 포함)는 건드리지 않는다.
// - 포털 월별 품목 내역에는 «발주일»이 없어 가장 이른 입고일(없으면 마감월 1일)을 전표 일자로 쓴다.
export async function POST(req: Request) {
  try {
    const { from, dryRun } = await req.json();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '')) return NextResponse.json({ error: '시작 일자(YYYY-MM-DD)가 필요합니다.' }, { status: 400 });
    const [lines, customers, existing] = await Promise.all([fetchAll('midong_orders', 'closeYm'), fetchAll('customers'), fetchAll('slips')]);
    const cust = (customers as any[]).find(c => String(c.name).includes('미동'));
    if (!cust) return NextResponse.json({ error: '거래처 «(주)미동이엔씨»를 찾지 못했습니다.' }, { status: 400 });
    const have = new Set((existing as any[]).map(s => s.id));
    const groups = new Map<string, any[]>();
    for (const l of lines as any[]) groups.set(l.rno, [...(groups.get(l.rno) || []), l]);
    const slips: any[] = [];
    let skippedOld = 0, skippedHave = 0;
    for (const [rno, ls] of groups) {
      const dates = ls.map(l => l.inDate).filter(Boolean).sort();
      const date = dates[0] || `${ls[0].closeYm.slice(0, 4)}-${ls[0].closeYm.slice(4)}-01`;
      if (date < from) { skippedOld++; continue; }
      const id = `mos-${rno}`;
      if (have.has(id)) { skippedHave++; continue; }
      const items = ls.map((l, i) => {
        const qty = Number(l.ordQty) || 0, unitPrice = Number(l.price) || 0, supply = Math.round(qty * unitPrice);
        return { id: `${id}-${i + 1}`, productId: '', productCode: '', productName: l.name, spec: l.spec || '', unit: l.unit || '', qty, unitPrice, supplyAmount: supply, taxAmount: 0, totalAmount: supply, memo: l.inQty !== l.ordQty ? `입고 ${l.inQty}` : '' };
      });
      const total = items.reduce((a, it) => a + it.supplyAmount, 0);
      const inAmt = ls.reduce((a, l) => a + (Number(l.inAmt) || 0), 0);
      const now = new Date().toISOString();
      const base = {
        id, slipNo: `M-${rno}`, slipDate: date, slipType: 'CONTRACT', customerId: cust.id, customerName: cust.name, siteName: ls[0].site || '',
        items, totalSupplyAmount: total, totalTaxAmount: 0, totalAmount: total, paymentType: 'credit', paidAmount: 0, unpaidAmount: 0,
        prevReceivables: cust.receivables || 0, memo: `[미동 청구 ${rno}] ${ls[0].site || ''} · 발주 ${items.length}품목 ${total.toLocaleString('ko-KR')}원 · 입고 ${inAmt.toLocaleString('ko-KR')}원 (포털 월별 품목 내역에서 가져옴)`,
        createdAt: now, deliveryStatus: 'none'
      };
      const digitalSignature = crypto.createHash('sha256').update(`${base.slipNo}-${base.slipDate}-${base.customerId}-${base.totalAmount}-${base.createdAt}`).digest('hex');
      slips.push({ ...base, digitalSignature });
    }
    const summary = { from, 청구번호: groups.size, 만들_수주전표: slips.length, 이미_있음: skippedHave, 시작일_이전: skippedOld, 발주금액합계: slips.reduce((a, s) => a + s.totalAmount, 0) };
    if (dryRun) return NextResponse.json({ dryRun: true, ...summary, 미리보기: slips.slice(0, 5).map(s => ({ slipNo: s.slipNo, slipDate: s.slipDate, site: s.siteName, items: s.items.length, total: s.totalAmount })) });
    for (let i = 0; i < slips.length; i += 200) {
      const { error } = await supabase.from('slips').insert(slips.slice(i, i + 200).map(({ digitalSignature, ...rest }) => rest));
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ created: true, ...summary });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '가져오기 실패' }, { status: 500 });
  }
}
