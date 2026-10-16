import { supabase } from '@/lib/supabase';
import { headers } from 'next/headers';

// 변경 이력(감사 기록). 전표·품목·거래처의 생성·수정·삭제와 미동 전환을 `audit_log` 표에 한 줄씩 남긴다.
// 기록이 실패해도(표가 없거나 네트워크 오류) 본 작업은 막지 않는다 — 그래서 오류는 삼키고 경고만 남긴다.
// «누가»(actor): 로그인이 켜져 있으면 proxy.ts가 붙인 머리글(x-user-id)에서 자동으로 채운다. 로그인이 꺼져 있으면 비어 있다.
export async function audit(action: string, entity: string, entityId: string, summary: string, detail?: unknown, actor = '') {
  try {
    if (!actor) { try { actor = (await headers()).get('x-user-id') || ''; } catch { /* 요청 밖(스크립트)에서 부르면 없음 */ } }
    const { error } = await supabase.from('audit_log').insert({
      id: `au-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(), action, entity, entityId, summary, actor, detail: detail ?? null
    });
    if (error) console.warn('audit_log 기록 실패:', error.message);
  } catch (e) { console.warn('audit_log 기록 실패:', e); }
}

/** 수정 전/후 값 비교: 보낸 항목 중 실제로 바뀐 것만 {키:[전,후]}로 돌려준다. */
export function diffFields(before: Record<string, any> | null | undefined, patch: Record<string, any>) {
  const out: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(patch || {})) {
    const a = before?.[k], b = patch[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = [a ?? null, b];
  }
  return out;
}
