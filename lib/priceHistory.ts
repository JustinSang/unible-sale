// 원본 Price 표(거래처×품목): Price1=최근 거래단가, Price2·3=그 이전. 저장 때 단가가 바뀌었으면 한 칸씩 밀어 넣는다(Date1~3 이동과 같은 규칙).
// 지름길: 날짜 칸(Date1~3)은 이관 스키마에 없어 값만 관리한다 — 날짜는 전표 이력에서 계산해 보여 준다.
export interface PriceRow { price1?: number | null; price2?: number | null; price3?: number | null }
export function shiftPrices(existing: PriceRow | null | undefined, newPrice: number): { price1: number; price2: number; price3: number } | null {
  if (!(newPrice > 0)) return null;
  const p1 = Number(existing?.price1) || 0, p2 = Number(existing?.price2) || 0;
  if (existing && p1 === newPrice) return null; // 같은 단가면 이력을 바꾸지 않는다
  return { price1: newPrice, price2: p1, price3: p2 };
}
