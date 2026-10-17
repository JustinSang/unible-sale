// 저장된 전표를 «수정 저장»할 때 옛 전표가 남긴 영향(재고·거래처 미수금·배송 요청)을 되돌리거나 다시 입히는 도구.
// 규칙은 전표 삭제(app/api/slips/[id]/route.ts)와 같다 — 전표 유형 비교도 같은 방식(원문 그대로)이라 이관 전표('sales' 소문자)는 재고·미수금에 손대지 않는다.
import { supabase } from '@/lib/supabase';

type OpCfg = unknown; // openingConfig() 결과 — 있으면 «장부 방식»(미수금은 syncReceivables가 맞춘다)

const stockDelta = (slip: any, item: any): number => {
  const st = slip.slipType;
  return st === 'SALES' || st === 'RETURN_OUT' ? Number(item.qty) || 0 : st === 'PURCHASE' || st === 'RETURN_IN' ? -(Number(item.qty) || 0) : 0;
};

// sign=+1: 옛 전표의 영향을 되돌린다(삭제와 같음). sign=-1: 되돌렸던 것을 다시 입힌다(수정 저장이 실패했을 때 원상복구).
export async function applyOldSlipEffects(slip: any, opCfg: OpCfg, sign: 1 | -1) {
  if (!opCfg && slip.slipType === 'SALES') {
    const { data: cust } = await supabase.from('customers').select('receivables').eq('id', slip.customerId).maybeSingle();
    if (cust) {
      const unpaid = slip.unpaidAmount || 0;
      const next = sign === 1 ? Math.max(0, (cust.receivables || 0) - unpaid) : (cust.receivables || 0) + unpaid;
      await supabase.from('customers').update({ receivables: next }).eq('id', slip.customerId);
    }
  }
  for (const item of slip.items || []) {
    if (!item.productId) continue;
    const delta = stockDelta(slip, item) * sign;
    if (delta === 0) continue;
    const { data: p } = await supabase.from('products').select('currentStock').eq('id', item.productId).maybeSingle();
    if (p) await supabase.from('products').update({ currentStock: p.currentStock + delta }).eq('id', item.productId);
  }
}
