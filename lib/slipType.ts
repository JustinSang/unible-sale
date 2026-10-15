// 이관 데이터의 전표 유형 표기는 'sales'·'SALES'·'return_sales'처럼 섞여 있다 — 대문자 표준형(SlipType)으로 맞춘다.
import type { SlipType } from '@/types';
export function normSlipType(t: string): SlipType {
  const u = String(t || '').toUpperCase();
  if (u === 'RETURN_SALES') return 'RETURN_IN';
  if (u === 'RETURN_PURCHASE') return 'RETURN_OUT';
  return u as SlipType;
}
export const SLIP_TYPE_LABEL: Record<string, string> = { SALES: '매출', PURCHASE: '매입', RETURN_IN: '반입', RETURN_OUT: '반출', ESTIMATE: '견적', ORDER: '발주', DELIVERY: '납품', CONTRACT: '수주' };
