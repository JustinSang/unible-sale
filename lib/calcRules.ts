// 금액 반올림 규칙. 공급가액·부가세를 각각 «반올림(R) / 내림(F) / 올림(C)» 으로 고른다.
// 근거: 이카운트 계산 모듈 해독(docs/analysis_rea/ecount/ecount_계산규칙_아이콘바_REA분석_2026-10-17.md) — 회사 설정 AMT_CALC·VAT_CALC.
// 기본값 R은 기존 동작(Math.round)과 완전히 같다 — 설정을 건드리지 않으면 아무것도 바뀌지 않는다.
export type RoundMode = 'R' | 'F' | 'C';
export interface CalcConfig { amt: RoundMode; vat: RoundMode }
export const DEFAULT_CALC: CalcConfig = { amt: 'R', vat: 'R' };

const isMode = (m: unknown): m is RoundMode => m === 'R' || m === 'F' || m === 'C';

/** 저장된 설정(없거나 잘못된 값 포함)을 안전한 값으로 만든다. */
export function normalizeCalc(c?: Partial<CalcConfig> | null): CalcConfig {
  return { amt: isMode(c?.amt) ? c!.amt! : 'R', vat: isMode(c?.vat) ? c!.vat! : 'R' };
}

/** 원 단위 정수로 맞춘다. R은 Math.round와 같다(기존 동작 보존, 단 -0은 0으로). F·C는 «정수에 아주 가까운 값»을 부동소수 잡음(0.1*3=0.30000000000000004,
 *  1.1e12 곱셈 오차)으로 보고 정수로 붙인 뒤 내림·올림한다. 허용 오차는 값 크기에 비례(상대 5e-16, 최소 1e-9) — 고액에서도 잡음만 지우고 진짜 소수는 남긴다.
 *  지름길: 음수는 F=수학적 floor, C=ceil. 이 앱은 반품 전표도 수량을 양수로 두므로 지금은 영향 없다. 음수 공급가액(수정세금계산서)을 도입할 때는
 *  국세청 «절사»가 0 방향(Math.trunc)이므로 F를 trunc로 바꿀지 그때 정한다(저커버그2 교차검수 지적, 2026-10-17). */
export function roundBy(x: number, mode: RoundMode): number {
  if (!Number.isFinite(x)) return 0;
  let r: number;
  if (mode === 'R') r = Math.round(x);
  else {
    const nearest = Math.round(x);
    const tol = Math.max(1e-9, Math.abs(x) * 5e-16);
    r = Math.abs(x - nearest) <= tol ? nearest : (mode === 'F' ? Math.floor(x) : Math.ceil(x));
  }
  return r === 0 ? 0 : r; // -0 방지
}

export const ROUND_LABEL: Record<RoundMode, string> = { R: '반올림', F: '내림(절사)', C: '올림' };
