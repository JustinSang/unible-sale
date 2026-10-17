'use client';

// 백업·복원 화면: 백업 목록과 상태, 선택한 백업과 «지금 자료» 비교, 새 백업 만들기.
// 복원은 화면에서 하지 않는다 — 로그인이 꺼져 있으면 누구든 한 번 눌러 운영 자료를 덮어쓸 수 있어서, 비교 결과를 보고 아래 명령을 터미널에서 실행하게 했다(scripts/server/restore_backup.sh).
import React, { useEffect, useState } from 'react';

interface Backup { name: string; size: number; mtime: string; kind: string }
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)}MB`;
const ago = (iso: string, now: number) => { const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000)); return m < 60 ? `${m}분 전` : m < 2880 ? `${Math.round(m / 60)}시간 전` : `${Math.round(m / 1440)}일 전`; };

export function BackupPanel() {
  const [data, setData] = useState<{ available: boolean; message?: string; backups?: Backup[]; now?: string } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [cmp, setCmp] = useState<{ name: string; rows: { table: string; backup: number; current: number; diff: number }[] } | null>(null);

  const load = async () => {
    try { const r = await fetch('/api/backups'); const d = await r.json(); if (!r.ok) throw new Error(d.error || String(r.status)); setData(d); setErr(''); } catch (e: any) { setErr(e.message || String(e)); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true); setMsg('');
    try { const r = await fetch('/api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create' }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || String(r.status)); setMsg(`백업을 만들었습니다: ${d.name} (${mb(d.size)})`); await load(); } catch (e: any) { setMsg(`오류: ${e.message || e}`); }
    setBusy(false);
  };
  const compare = async (name: string) => {
    setMsg(''); setCmp(null);
    try { const r = await fetch(`/api/backups?compare=${encodeURIComponent(name)}`); const d = await r.json(); if (!r.ok) throw new Error(d.error || String(r.status)); setCmp(d); } catch (e: any) { setMsg(`오류: ${e.message || e}`); }
  };

  const now = data?.now ? new Date(data.now).getTime() : Date.now();
  const latest = data?.backups?.[0];
  const staleH = latest ? (now - new Date(latest.mtime).getTime()) / 3600000 : null;

  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs text-xs space-y-2">
      <h3 className="font-bold text-xs text-slate-800">자료 백업·복원</h3>
      {err && <p className="text-red-600 font-semibold">오류: {err}</p>}
      {data && !data.available && <p className="text-slate-500">{data.message}</p>}
      {data?.available && <>
        <div className="flex flex-wrap items-center gap-3">
          <span>백업 {data.backups!.length}개 · 가장 최근 <b>{latest ? ago(latest.mtime, now) : '없음'}</b></span>
          {staleH !== null && staleH > 12 && <span className="text-rose-600 font-semibold">12시간 넘게 새 백업이 없습니다 — DB 서버 상태를 확인하세요</span>}
          <button type="button" onClick={create} disabled={busy} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5 font-bold disabled:opacity-50">{busy ? '만드는 중…' : '지금 백업 만들기'}</button>
        </div>
        <p className="text-slate-500">DB 서버가 시작할 때와 6시간마다, 매일 03:10에 자동으로 만들어집니다(자동 백업은 최근 40~60개만 남습니다). 드라이브 사본은 매일 03:10 작업이 올립니다.</p>
        {msg && <p className={msg.startsWith('오류') ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>{msg}</p>}
        <div className="max-h-56 overflow-auto"><table className="w-full border-collapse">
          <thead><tr className="bg-slate-50 text-slate-500 border-b sticky top-0"><th className="p-1 text-left">파일</th><th className="p-1">종류</th><th className="p-1 text-right">크기</th><th className="p-1 text-right">만든 때</th><th className="p-1" /></tr></thead>
          <tbody>{data.backups!.map(b => (
            <tr key={b.name} className={`border-b border-slate-100 ${cmp?.name === b.name ? 'bg-blue-50' : ''}`}>
              <td className="p-1 font-mono">{b.name}</td><td className="p-1 text-center">{b.kind}</td><td className="p-1 text-right">{mb(b.size)}</td><td className="p-1 text-right">{new Date(b.mtime).toLocaleString('ko-KR')} ({ago(b.mtime, now)})</td>
              <td className="p-1 text-center"><button type="button" onClick={() => compare(b.name)} className="text-blue-700 hover:underline">지금과 비교</button></td>
            </tr>))}
          </tbody></table></div>
        {cmp && (
          <div className="border border-slate-200 rounded p-2 space-y-1 bg-slate-50">
            <b>{cmp.name} ↔ 지금 자료</b>
            <table className="border-collapse"><thead><tr className="text-slate-500"><th className="px-2 text-left">표</th><th className="px-2 text-right">백업</th><th className="px-2 text-right">지금</th><th className="px-2 text-right">차이</th></tr></thead>
              <tbody>{cmp.rows.map(r => <tr key={r.table}><td className="px-2">{r.table}</td><td className="px-2 text-right font-mono">{r.backup.toLocaleString()}</td><td className="px-2 text-right font-mono">{r.current.toLocaleString()}</td><td className={`px-2 text-right font-mono ${r.diff < 0 ? 'text-rose-600 font-bold' : ''}`}>{r.diff > 0 ? '+' : ''}{r.diff.toLocaleString()}</td></tr>)}</tbody></table>
            <p className="text-slate-600">«차이»가 음수면 그 백업 뒤에 쌓인 자료입니다. 이 백업으로 되돌리면 그 자료는 사라집니다(복원 직전 사본은 자동 저장). 되돌리려면 터미널에서 아래 명령을 실행하세요 — 먼저 «미리보기», 확인 뒤 <code>--yes</code>.</p>
            <pre className="bg-white border border-slate-200 rounded p-1.5 overflow-x-auto select-all">{`bash scripts/server/restore_backup.sh ${cmp.name}\nbash scripts/server/restore_backup.sh ${cmp.name} --yes`}</pre>
          </div>
        )}
      </>}
    </div>
  );
}
