// 세액(부가세) 규칙 — 화면(전표 입력)과 서버(전표 저장)가 같은 함수를 쓴다.
// 근거: 이카운트 소스 분석(docs/analysis_rea/ecount/ecount_서버규약_REA분석_2026-10-17.md) — 거래유형·품목 설정이 회사 기본 세율보다 우선한다.
// 규칙(우선순위 순):
//  ① 면세 거래처(거래처 vatType = 'none')          → 세액 0 (세액 «가산»을 골라도 0)
//  ② 면세·영세 품목(taxType = 'exempt'|'zero')     → 세액 0 (영세는 과세 거래지만 세율 0%, 면세는 과세 대상 아님 — 둘 다 세액은 0)
//  ③ 전표가 «별도(세액 없음)»                       → 세액 0
//  ④ 그 밖(과세 품목·미지정)                        → 공급가액 × 세율 ÷ 100 을 설정한 방식(반올림 R/F/C)으로
import { roundBy, type RoundMode } from './calcRules';

export type TaxType = 'taxable' | 'exempt' | 'zero';
export const TAX_TYPE_LABEL: Record<TaxType, string> = { taxable: '과세', exempt: '면세', zero: '영세율' };

/** 저장된 값(없거나 이상한 값 포함)을 안전한 값으로 — 모르면 과세(기존 동작). */
export const normTaxType = (v: unknown): TaxType => (v === 'exempt' || v === 'zero' ? v : 'taxable');

/** 이 줄에 세액이 «절대 붙지 않는» 경우인가(면세 거래처·면세/영세 품목). */
export const isTaxFree = (taxType: unknown, customerVat?: unknown): boolean => customerVat === 'none' || normTaxType(taxType) !== 'taxable';

export interface TaxCtx { mode: 'incl' | 'excl'; rate: number; calcVat?: RoundMode; customerVat?: unknown }

/** 화면용: 한 줄의 세액. */
export function lineTax(supply: number, taxType: unknown, ctx: TaxCtx): number {
  if (!Number.isFinite(supply) || supply === 0) return 0;
  if (isTaxFree(taxType, ctx.customerVat)) return 0;
  if (ctx.mode !== 'incl') return 0;
  return roundBy(supply * (ctx.rate / 100), ctx.calcVat ?? 'R');
}

/** 서버용: 화면이 보낸 세액을 믿지 않고 규칙대로 바로잡는다. 화면이 0을 보냈으면 «별도» 전표이므로 0, 양수를 보냈으면 세율대로 계산한 값. 음수·숫자 아님은 0. */
export function serverLineTax(supply: number, clientTax: unknown, taxType: unknown, customerVat: unknown, rate: number, calcVat: RoundMode = 'R'): number {
  if (isTaxFree(taxType, customerVat)) return 0;
  const c = Number(clientTax);
  if (!Number.isFinite(c) || c <= 0) return 0;
  return roundBy(supply * (rate / 100), calcVat);
}
