import { supabase } from '@/lib/supabase';

// 변경 이력(감사 기록). 전표·품목·거래처의 생성·수정·삭제와 미동 전환을 `audit_log` 표에 한 줄씩 남긴다.
// 기록이 실패해도(표가 없거나 네트워크 오류) 본 작업은 막지 않는다 — 그래서 오류는 삼키고 경고만 남긴다.
// 지름길: 지금은 로그인 사용자가 없어 «누가»(actor)는 비어 있다. 로그인·역할을 도입하면 여기서 채운다.
export async function audit(action: string, entity: string, entityId: string, summary: string, detail?: unknown, actor = '') {
  try {
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
