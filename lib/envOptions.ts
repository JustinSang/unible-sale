// 사용자 환경설정(원본 «사용자 환경설정» 창 중 이 앱에서 실제로 동작을 연결한 항목). system_config.config.options 에 저장한다.
// 원본 항목 전수 대조와 «아직 연결하지 않은 항목»은 docs/oksale-parity/환경설정_원본항목_대조_2026-10-17.md 에 있다.
export interface EnvOptions {
  priceDecimals: 0 | 1 | 2;      // 단가 소수점 자리수(원본 «단가 소수점») — 전표 입력 때 기본값
  qtyDecimals: 0 | 1 | 2 | 3;    // 수량 소수점 자리수(원본 «수량 소수점»)
  vatRate: number;               // 부가가치세 세율 %(원본 «부가가치세세율»)
  creditLimitCheck: boolean;     // 여신한도관리: 매출 저장 때 거래처 여신한도를 넘으면 확인을 묻는다(원본의 정확한 동작은 미확인 — 경고 후 진행 선택으로 만듦)
  autoSaveSalesPrice: boolean;   // 매출가 자동저장(원본): 매출 저장 때 거래처별 단가 이력 갱신
  autoSavePurchasePrice: boolean; // 매입가 자동저장(원본): 매입 저장 때 품목의 매입단가·최종매입처 갱신
}
export const DEFAULT_OPTIONS: EnvOptions = { priceDecimals: 0, qtyDecimals: 0, vatRate: 10, creditLimitCheck: false, autoSaveSalesPrice: true, autoSavePurchasePrice: true };

const pick = <T extends number>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(Number(v) as T) ? (Number(v) as T) : d);

// 없거나 이상한 값은 기본값으로(기존 동작 그대로).
export function normalizeOptions(raw?: Partial<EnvOptions> | null): EnvOptions {
  const o = raw || {};
  const vat = Number(o.vatRate);
  return {
    priceDecimals: pick(o.priceDecimals, [0, 1, 2] as const, 0),
    qtyDecimals: pick(o.qtyDecimals, [0, 1, 2, 3] as const, 0),
    vatRate: Number.isFinite(vat) && vat >= 0 && vat <= 100 ? vat : DEFAULT_OPTIONS.vatRate,
    creditLimitCheck: o.creditLimitCheck === true,
    autoSaveSalesPrice: o.autoSaveSalesPrice !== false,
    autoSavePurchasePrice: o.autoSavePurchasePrice !== false
  };
}
export const roundTo = (n: number, d: number) => { const f = Math.pow(10, d); return Math.round((Number(n) + Number.EPSILON) * f) / f; };
