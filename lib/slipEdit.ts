// 저장된 전표를 «수정 저장»할 때 옛 전표가 남긴 영향(재고·거래처 미수금·배송 요청)을 되돌리거나 다시 입히는 도구.
// 규칙은 전표 삭제(app/api/slips/[id]/route.ts)와 같다 — 전표 유형 비교도 같은 방식(원문 그대로)이라 이관 전표('sales' 소문자)는 재고·미수금에 손대지 않는다.
import { supabase } from '@/lib/supabase';

type OpCfg = unknown; // openingConfig() 결과 — 있으면 «장부 방식»(미수금은 syncReceivables가 맞춘다)

// 재고수불부 기록 시각: 같은 밀리초에 여러 기록이 생겨도 «실제 일어난 순서»대로 정렬되도록 항상 이전보다 크게 만든다.
let lastTs = 0;
export function uniqueNow(): Date { const t = Math.max(Date.now(), lastTs + 1); lastTs = t; return new Date(t); }

const stockDelta = (slip: any, item: any): number => {
  const st = slip.slipType;
  return st === 'SALES' || st === 'RETURN_OUT' ? Number(item.qty) || 0 : st === 'PURCHASE' || st === 'RETURN_IN' ? -(Number(item.qty) || 0) : 0;
};

// sign=+1: 옛 전표의 영향을 되돌린다(삭제·수정 저장 때). sign=-1: 되돌렸던 것을 다시 입힌다(수정 저장이 실패했을 때 원상복구).
// 재고가 움직이면 재고수불부(inventory_logs)에 «왜 움직였는지» 한 줄을 남긴다 — 예전에는 전표를 저장할 때만 기록이 남고, 삭제·수정 때는 재고만 바뀌어 수불부와 현재고가 어긋났다.
export async function applyOldSlipEffects(slip: any, opCfg: OpCfg, sign: 1 | -1, why: 'delete' | 'edit' | 'restore' = 'edit') {
  if (!opCfg && slip.slipType === 'SALES') {
    const { data: cust } = await supabase.from('customers').select('receivables').eq('id', slip.customerId).maybeSingle();
    if (cust) {
      const unpaid = slip.unpaidAmount || 0;
      const next = sign === 1 ? Math.max(0, (cust.receivables || 0) - unpaid) : (cust.receivables || 0) + unpaid;
      await supabase.from('customers').update({ receivables: next }).eq('id', slip.customerId);
    }
  }
  const reason = why === 'delete' ? `전표 삭제로 재고 되돌림: ${slip.slipNo || ''}` : why === 'restore' ? `전표 수정 실패로 재고 원상복구: ${slip.slipNo || ''}` : `전표 수정 — 이전 내용의 재고 취소: ${slip.slipNo || ''}`;
  let n = 0;
  for (const item of slip.items || []) {
    if (!item.productId) continue;
    const delta = stockDelta(slip, item) * sign;
    if (delta === 0) continue;
    const { data: p } = await supabase.from('products').select('currentStock, name, spec').eq('id', item.productId).maybeSingle();
    if (!p) continue;
    const before = Number(p.currentStock) || 0, after = before + delta;
    await supabase.from('products').update({ currentStock: after }).eq('id', item.productId);
    const now = uniqueNow();
    const { error } = await supabase.from('inventory_logs').insert({
      id: `il-${now.getTime()}-${n++}-${Math.random().toString(36).slice(2, 6)}`, date: now.toISOString().slice(0, 10), productId: item.productId, productName: p.name || item.productName || '', spec: p.spec || item.spec || '',
      changeType: delta > 0 ? 'adjust_plus' : 'adjust_minus', changeQty: Math.abs(delta), beforeQty: before, afterQty: after, slipNo: slip.slipNo, reason, createdAt: now.toISOString()
    });
    if (error) console.error('inventory_logs insert failed:', error.message);
  }
}
