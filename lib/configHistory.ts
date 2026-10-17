// 환경설정 변경 이력: 설정이 바뀔 때마다 «바뀌기 전» 설정을 config_history 표에 남겨 두고(최근 40개), 그 시점으로 되돌릴 수 있게 한다.
// 되돌리기는 환경설정 탭이 관리하는 항목(MANAGED)만 건드린다 — 기초잔액·관리자 PIN 등 다른 설정은 그대로 둔다. 되돌리기 자체도 이력에 남아서 «되돌리기를 되돌릴» 수 있다.
import { supabase } from '@/lib/supabase';

export const MANAGED = ['dbPath', 'reportPath', 'printers', 'cloudSyncEnabled', 'syncIntervalSec', 'calc', 'options', 'companyInfo'] as const;
const KEEP = 40;
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// 항목별 «무엇이 달라졌나» 이름(사람이 읽는 말). options 는 전표 기본 설정과 거래명세표 추가 출력을 따로 센다.
export function diffLabels(a: any, b: any): string[] {
  const out: string[] = [];
  if (!same(a?.printers, b?.printers) || !same(a?.dbPath, b?.dbPath) || !same(a?.reportPath, b?.reportPath)) out.push('프린터·저장 위치');
  if (!same(a?.cloudSyncEnabled, b?.cloudSyncEnabled) || !same(a?.syncIntervalSec, b?.syncIntervalSec)) out.push('동기화');
  if (!same(a?.calc, b?.calc)) out.push('금액 반올림');
  if (!same(a?.companyInfo, b?.companyInfo)) out.push('회사정보');
  const { print: pa, ...oa } = a?.options || {}; const { print: pb, ...ob } = b?.options || {};
  if (!same(oa, ob)) out.push('전표 기본 설정');
  if (!same(pa, pb)) out.push('거래명세표 추가 출력');
  return out;
}

// 현재 저장된 설정을 이력에 한 줄 남긴다(바뀐 것이 없으면 남기지 않는다). next 는 곧 저장될 설정.
export async function snapshotBefore(next: any, actor = '') {
  try {
    const { data: cur } = await supabase.from('system_config').select('config').eq('id', 'default').maybeSingle();
    if (!cur?.config || diffLabels(cur.config, next).length === 0) return;
    await supabase.from('config_history').insert({ id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString(), actor, config: cur.config });
    const { data: all } = await supabase.from('config_history').select('id, at');
    const old = (all || []).sort((x: any, y: any) => String(y.at).localeCompare(String(x.at))).slice(KEEP);
    for (const o of old) await supabase.from('config_history').delete().eq('id', o.id);
  } catch (e) { console.error('config_history 기록 실패:', (e as Error).message); } // 이력 실패가 설정 저장을 막지 않는다
}
