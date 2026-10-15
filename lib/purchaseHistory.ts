// 매입 전표를 저장하면 품목의 «매입단가·최종매입처·일자·가»를 갱신한다(원본 상품코드 관리 매뉴얼: «매입전표를 등록하면 매입단가가 자동으로 넘어오므로»).
// 직전 1건은 최종매입2로 밀려난다. 같은 매입처·같은 날의 재입력은 밀지 않고 1번을 덮어쓴다.
// 지름길: 원본의 정확한 밀어 넣는 조건(같은 매입처 판정 등)은 확인 못 함 — 위 규칙은 화면 동작 설명에 맞춘 추정.
export interface PurchaseFields { supplier?: string; lastPurchaseDate?: string; lastPurchasePrice?: number; supplier2?: string; lastPurchaseDate2?: string; lastPurchasePrice2?: number }
export function rotatePurchase(cur: PurchaseFields, supplier: string, date: string, price: number): Record<string, unknown> | null {
  if (!(price > 0) || !date) return null;
  const has1 = !!(cur.lastPurchaseDate || cur.lastPurchasePrice || cur.supplier);
  const sameAs1 = has1 && (cur.supplier || '') === supplier && (cur.lastPurchaseDate || '') === date;
  const older = !!cur.lastPurchaseDate && date < cur.lastPurchaseDate; // 오래된 날짜를 늦게 입력해도 최신 매입 정보는 지키지 않는다(1번을 건드리지 않음)
  if (older) return null;
  const patch: Record<string, unknown> = { costPrice: price, purchasePrice: price, supplier, lastPurchaseDate: date, lastPurchasePrice: price };
  if (has1 && !sameAs1) { patch.supplier2 = cur.supplier || ''; patch.lastPurchaseDate2 = cur.lastPurchaseDate || ''; patch.lastPurchasePrice2 = cur.lastPurchasePrice || 0; }
  return patch;
}
