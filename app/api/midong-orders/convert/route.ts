export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchAll } from '@/lib/loadAll';
import { audit } from '@/lib/audit';

// 미동 수주 전표(id `mos-…`)의 매출 전환·정산 상태 변경.
// action: toSales(수주→매출, settle 'paid'|'unpaid') · toContract(매출→수주로 되돌리기) · settle(미수→정산완료) · unsettle(정산완료→미수)
// 대상: ids 또는 from~to(전표일자). 재고는 건드리지 않는다(품목 코드 연결 없음). 미수금은 매출 전표의 unpaidAmount 합만큼 거래처에 반영한다.
// 지름길: 여러 전표를 한 줄씩 갱신한다(수천 건이면 수십 초). 필요 시 일괄 SQL로 바꾼다.
export async function POST(req: Request) {
  try {
    const { action, ids, from, to, settle, dryRun } = await req.json();
    if (!['toSales', 'toContract', 'settle', 'unsettle'].includes(action)) return NextResponse.json({ error: 'action 값이 올바르지 않습니다.' }, { status: 400 });
    const all = (await fetchAll('slips')) as any[];
    const inRange = (s: any) => (!from || s.slipDate >= from) && (!to || s.slipDate <= to);
    let targets = all.filter(s => String(s.id).startsWith('mos-') && (Array.isArray(ids) && ids.length ? ids.includes(s.id) : inRange(s)));
    const needType = action === 'toSales' ? 'CONTRACT' : 'SALES';
    const skipped = targets.filter(s => s.slipType !== needType).length;
    targets = targets.filter(s => s.slipType === needType);
    if (action === 'settle') targets = targets.filter(s => (s.unpaidAmount || 0) > 0);
    if (action === 'unsettle') targets = targets.filter(s => (s.unpaidAmount || 0) === 0 && (s.totalAmount || 0) > 0);
    // 같은 기간 ERP 미동 매출 건수(이중계상 경고용). 이관 전표 유형은 소문자 'sales'가 섞여 있어 대문자로 맞춰 비교하고, 전표를 골라 보낸 경우엔 고른 전표들의 일자 범위를 쓴다.
    const dates = targets.map(s => s.slipDate).sort(), lo = from || dates[0], hi = to || dates[dates.length - 1];
    const erpOverlap = action === 'toSales' && targets.length ? all.filter(s => String(s.customerName).includes('미동') && !String(s.id).startsWith('mos-') && String(s.slipType).toUpperCase() === 'SALES' && s.slipDate >= lo && s.slipDate <= hi).length : 0;
    const plan = targets.map(s => {
      const total = Number(s.totalAmount) || 0, oldUnpaid = Number(s.unpaidAmount) || 0;
      let paid = Number(s.paidAmount) || 0, unpaid = oldUnpaid, slipType = s.slipType;
      if (action === 'toSales') { slipType = 'SALES'; paid = settle === 'unpaid' ? 0 : total; unpaid = total - paid; }
      else if (action === 'toContract') { slipType = 'CONTRACT'; paid = 0; unpaid = 0; }
      else if (action === 'settle') { paid = total; unpaid = 0; }
      else { paid = 0; unpaid = total; }
      const oldCount = s.slipType === 'SALES' ? oldUnpaid : 0, newCount = slipType === 'SALES' ? unpaid : 0;
      return { s, slipType, paid, unpaid, delta: newCount - oldCount };
    });
    const sum = { action, 대상: plan.length, 건너뜀_유형불일치: skipped, 금액합계: plan.reduce((a, p) => a + (Number(p.s.totalAmount) || 0), 0), 미수금_변화: plan.reduce((a, p) => a + p.delta, 0), ERP_기존_미동매출_같은기간: erpOverlap };
    if (dryRun) return NextResponse.json({ dryRun: true, ...sum });
    const today = new Date().toISOString().slice(0, 10);
    const label = action === 'toSales' ? `[수주→매출 전환 ${today}${settle === 'unpaid' ? ' 미수' : ' 정산완료'}]` : action === 'toContract' ? `[매출→수주 되돌림 ${today}]` : action === 'settle' ? `[정산완료 처리 ${today}]` : `[미수로 변경 ${today}]`;
    const stripTag = /\s?\[(수주→매출 전환|매출→수주 되돌림|정산완료 처리|미수로 변경)[^\]]*\]/g;
    for (let i = 0; i < plan.length; i += 25) {
      const rs = await Promise.all(plan.slice(i, i + 25).map(p => supabase.from('slips').update({
        slipType: p.slipType, paidAmount: p.paid, unpaidAmount: p.unpaid, paymentType: p.unpaid > 0 ? 'credit' : 'cash', memo: `${String(p.s.memo || '').replace(stripTag, '')} ${label}`.trim()
      }).eq('id', p.s.id)));
      const bad = rs.find(r => r.error); if (bad?.error) throw new Error(bad.error.message);
    }
    const delta = plan.reduce((a, p) => a + p.delta, 0);
    if (delta !== 0 && plan.length) {
      const cid = plan[0].s.customerId;
      const { data: c } = await supabase.from('customers').select('receivables').eq('id', cid).maybeSingle();
      await supabase.from('customers').update({ receivables: (c?.receivables || 0) + delta }).eq('id', cid);
    }
    if (plan.length) await audit('convert', 'slip', 'mos-batch', `미동 전표 ${action} ${plan.length}건 (${Number(sum.금액합계).toLocaleString('ko-KR')}원)`, { action, settle: settle ?? null, 건수: plan.length, 금액합계: sum.금액합계, 미수금_변화: sum.미수금_변화, 전표: plan.slice(0, 500).map(p => p.s.id) });
    return NextResponse.json({ done: true, ...sum });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '전환 실패' }, { status: 500 });
  }
}
