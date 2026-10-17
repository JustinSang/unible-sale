'use client';

// 환경설정 변경 이력과 되돌리기. 저장할 때마다 «바뀌기 전» 설정이 남고, 고른 시점으로 되돌릴 수 있다(기초잔액·관리자 PIN 등 다른 설정은 그대로).
import React, { useEffect, useState } from 'react';

interface Row { id: string; at: string; actor: string; changed: string[] }

export function ConfigHistoryPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => { try { const r = await fetch('/api/config-history'); if (r.ok) setRows(await r.json()); } catch { setRows([]); } };
  useEffect(() => { load(); }, []);

  const restore = async (row: Row) => {
    if (!confirm(`${new Date(row.at).toLocaleString('ko-KR')} 이전의 설정으로 되돌립니다(바뀌는 항목: ${row.changed.join(', ')}). 지금 설정도 이력에 남아서 다시 되돌릴 수 있습니다. 계속할까요?`)) return;
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/config-history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: row.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      setMsg(d.message || `되돌렸습니다(${(d.changed || []).join(', ')}). 화면을 새로 불러옵니다…`);
      if (!d.message) setTimeout(() => window.location.reload(), 1200);
      else await load();
    } catch (e: any) { setMsg(`오류: ${e.message || e}`); }
    setBusy(false);
  };

  if (!rows) return null;
  const shown = rows.filter(r => r.changed.length > 0);
  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs text-xs space-y-2">
      <h3 className="font-bold text-xs text-slate-800">환경설정 변경 이력·되돌리기</h3>
      <p className="text-slate-500">환경설정을 저장할 때마다 바꾸기 전 설정이 남습니다(최근 40개). 아래에서 시점을 고르면 그때의 설정으로 되돌립니다. 오른쪽 «지금과 다른 항목»은 그 시점과 현재 설정이 다른 부분입니다.</p>
      {msg && <p className={msg.startsWith('오류') ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>{msg}</p>}
      {shown.length === 0 ? <p className="text-slate-400">되돌릴 수 있는 이전 설정이 아직 없습니다(저장한 뒤부터 쌓입니다).</p> : (
        <div className="max-h-44 overflow-auto"><table className="w-full border-collapse">
          <thead><tr className="bg-slate-50 text-slate-500 border-b sticky top-0"><th className="p-1 text-left">저장 직전 시각</th><th className="p-1 text-left">지금과 다른 항목</th><th className="p-1 w-24" /></tr></thead>
          <tbody>{shown.map(r => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="p-1 font-mono">{new Date(r.at).toLocaleString('ko-KR')}{r.actor ? ` · ${r.actor}` : ''}</td><td className="p-1">{r.changed.join(', ')}</td>
              <td className="p-1 text-center"><button type="button" onClick={() => restore(r)} disabled={busy} className="text-blue-700 hover:underline disabled:opacity-40">이 시점으로</button></td>
            </tr>))}
          </tbody></table></div>
      )}
    </div>
  );
}
