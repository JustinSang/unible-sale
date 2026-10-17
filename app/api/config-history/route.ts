export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { MANAGED, diffLabels, snapshotBefore } from '@/lib/configHistory';
import { audit } from '@/lib/audit';

// 환경설정 변경 이력 목록(GET)과 그 시점으로 되돌리기(POST {id}). 변경(POST)은 로그인이 켜져 있으면 관리자만(proxy).
export async function GET() {
  const [{ data: cur }, { data: rows }] = await Promise.all([
    supabase.from('system_config').select('config').eq('id', 'default').maybeSingle(),
    supabase.from('config_history').select('*')
  ]);
  const list = (rows || []).sort((a: any, b: any) => String(b.at).localeCompare(String(a.at))).map((r: any) => ({ id: r.id, at: r.at, actor: r.actor || '', changed: diffLabels(r.config, cur?.config) }));
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    const { data: snap } = await supabase.from('config_history').select('*').eq('id', String(id || '')).maybeSingle();
    if (!snap?.config) return NextResponse.json({ error: '해당 시점의 설정을 찾을 수 없습니다.' }, { status: 404 });
    const { data: cur } = await supabase.from('system_config').select('config').eq('id', 'default').maybeSingle();
    const next = { ...(cur?.config || {}) };
    for (const k of MANAGED) { if (k in snap.config) next[k] = snap.config[k]; else delete next[k]; }
    const changed = diffLabels(cur?.config, next);
    if (changed.length === 0) return NextResponse.json({ ok: true, changed: [], message: '이미 그 시점과 같은 설정입니다.' });
    await snapshotBefore(next); // 되돌리기 직전 설정도 이력에 남긴다(되돌리기를 다시 되돌릴 수 있게)
    const { error } = await supabase.from('system_config').upsert({ id: 'default', config: next });
    if (error) throw new Error(error.message);
    await audit('update', 'config', 'restore', `환경설정 되돌리기: ${new Date(snap.at).toLocaleString('ko-KR')} 시점 (${changed.join(', ')})`, { id: snap.id, changed });
    return NextResponse.json({ ok: true, changed, config: next });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '되돌리기 실패' }, { status: 500 });
  }
}
