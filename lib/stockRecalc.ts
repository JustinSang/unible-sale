// 재고 재계산 점검: «이월재고 + 매입·반입 수량 − 매출·반출 수량»을 전표에서 다시 세어 현재고와 비교한다.
// 규칙은 전표 저장(app/api/slips/route.ts)·삭제와 똑같다 — 전표 유형을 원문 그대로 비교하므로 이관 전표('sales'·'return_sales' 소문자)는 재고에 안 움직인 것으로 센다.
// 한계(실측 2026-10-17, 운영 DB 읽기 전용): 지금 DB에는 재고를 움직이는 대문자 전표 중 품목 코드가 있는 것이 0건이다(미동 수주는 코드 없음, 코드가 있는 이관 전표 1,240건은 소문자라 제외).
// 그래서 28,066개 품목의 «일치»는 전표 0건·재고 0이라서 맞는 것이다(검증력 낮음). 불일치 810개는 전부 «전표 0건인데 현재고가 정확히 100». 새 전표가 쌓일수록 이 점검이 의미를 갖는다.
const SIGN: Record<string, number> = { SALES: -1, RETURN_OUT: -1, PURCHASE: 1, RETURN_IN: 1 };

export interface StockDiff { id: string; code: string; name: string; spec: string; unit: string; opening: number; moved: number; expected: number; current: number; diff: number; slipLines: number; kind: 'noSlips' | 'hasSlips' }

export function recalcStock(products: any[], slips: any[]) {
  const moved = new Map<string, number>(); const lines = new Map<string, number>();
  let legacySlips = 0;
  for (const s of slips) {
    const sg = SIGN[s.slipType];
    if (!sg) { if (/^(sales|purchase|return_sales|return_purchase)$/i.test(String(s.slipType)) && s.slipType !== String(s.slipType).toUpperCase()) legacySlips++; continue; }
    for (const it of s.items || []) {
      if (!it.productId) continue;
      moved.set(it.productId, (moved.get(it.productId) || 0) + sg * (Number(it.qty) || 0));
      lines.set(it.productId, (lines.get(it.productId) || 0) + 1);
    }
  }
  const diffs: StockDiff[] = [];
  let checked = 0;
  for (const p of products) {
    if (p.stockManaged === false) continue;
    checked++;
    const opening = Number(p.openingStock) || 0, mv = moved.get(p.id) || 0, cur = Number(p.currentStock) || 0;
    const expected = opening + mv;
    if (Math.abs(expected - cur) < 1e-9) continue;
    const n = lines.get(p.id) || 0;
    diffs.push({ id: p.id, code: p.code, name: p.name, spec: p.spec, unit: p.unit, opening, moved: mv, expected, current: cur, diff: cur - expected, slipLines: n, kind: n === 0 ? 'noSlips' : 'hasSlips' });
  }
  return { checked, matched: checked - diffs.length, diffs, legacySlips };
}
