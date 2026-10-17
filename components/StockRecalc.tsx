'use client';

// 재고 점검·보정: 전표에서 재고를 다시 세어 현재고와 다른 품목을 보여 주고, 고른 품목만 다시 센 값으로 맞춘다(원본 «자료 보정·점검»의 재고 부분).
// 계산·쓰기는 모두 서버(/api/stock-recalc)가 한다 — 화면이 보낸 값은 쓰지 않고 요청 시점에 서버가 다시 계산한다. 시작할 때는 읽기만 한다.
import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { StockDiff } from '@/lib/stockRecalc';

const n = (v: number) => (v || 0).toLocaleString('ko-KR');
type Preview = { 검사품목: number; 일치: number; 불일치: number; 전표없음: number; 이관소문자전표_계산제외: number; diffs: StockDiff[] };

export function StockRecalcModal({ onClose, onRefresh }: { onClose: () => void; onRefresh?: () => Promise<void> | void }) {
  const [data, setData] = useState<Preview | null>(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [kind, setKind] = useState<'all' | 'noSlips' | 'hasSlips'>('all');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setErr(''); setData(null);
    try {
      const res = await fetch('/api/stock-recalc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'preview' }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || String(res.status));
      setData(d); setSel(new Set());
    } catch (e: any) { setErr(e.message || String(e)); }
  };
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    const k = q.trim().replace(/\s/g, '').toLowerCase();
    return (data?.diffs || []).filter(d => (kind === 'all' || d.kind === kind) && (!k || `${d.name}${d.spec}${d.code}`.replace(/\s/g, '').toLowerCase().includes(k)));
  }, [data, kind, q]);
  const shown = rows.slice(0, 300);

  const apply = async () => {
    if (sel.size === 0) return;
    if (!confirm(`선택한 ${sel.size}개 품목의 현재고를 전표 기준으로 다시 센 값으로 바꿉니다. 재고 기록이 남습니다. 계속할까요?`)) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/stock-recalc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'apply', productIds: [...sel], reason: '재고 점검 화면에서 보정' }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || String(res.status));
      setMsg(`${d.보정}개 품목을 보정했습니다.`);
      if (onRefresh) await onRefresh();
      await load();
    } catch (e: any) { setMsg(`오류: ${e.message || e}`); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50 rounded-t-lg">
          <b className="text-sm">재고 점검·보정 (전표로 다시 센 재고 ↔ 현재고)</b>
          <button type="button" onClick={onClose} aria-label="닫기"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 text-xs overflow-y-auto space-y-2">
          {err && <p className="text-red-600 font-semibold">오류: {err}</p>}
          {!data && !err && <p className="text-slate-500 py-8 text-center">전표를 다시 세는 중…</p>}
          {data && <>
            <div className="flex flex-wrap gap-x-5 gap-y-1 bg-slate-50 border border-slate-200 rounded px-3 py-2">
              <span>검사 <b>{n(data.검사품목)}</b>개 품목</span><span>일치 <b>{n(data.일치)}</b></span><span className={data.불일치 ? 'text-rose-600' : ''}>불일치 <b>{n(data.불일치)}</b></span><span>그중 전표가 없는 품목 <b>{n(data.전표없음)}</b></span>
            </div>
            <p className="text-slate-500">계산식: 이월재고 + 매입·반입 수량 − 매출·반출 수량(전표 저장 규칙과 같음). 견적·발주·납품·수주 전표는 재고를 움직이지 않습니다. 소문자로 이관된 옛 전표 {n(data.이관소문자전표_계산제외)}건은 전표 저장 규칙과 같이 재고에 움직인 것으로 세지 않았습니다.</p>
            {data.전표없음 > 0 && <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">«전표 없음»(전표가 한 건도 없는데 재고가 있는 품목)은 입력해 둔 실재고일 수 있습니다. 보정하면 0이 되니 <b>실물과 맞는지 확인한 뒤</b> 고르세요. 실물을 센 값으로 맞추려면 «재고 실사»를 쓰세요.</p>}
            <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">«전표 있음»인데 이월이 0인 품목은, 처음 가지고 있던 재고가 품목 등록의 <b>이월재고</b> 칸에 없어서 어긋난 것일 수 있습니다. 이 경우 보정 대신 이월재고를 먼저 넣으세요(보정하면 음수 재고가 됩니다).</p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={kind} onChange={e => { setKind(e.target.value as typeof kind); }} className="border rounded px-2 py-1"><option value="all">전체 불일치</option><option value="hasSlips">전표 있음(계산이 어긋남)</option><option value="noSlips">전표 없음</option></select>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="품명·규격·코드" className="border rounded px-2 py-1 w-48" />
              <span className="text-slate-500">{n(rows.length)}건{rows.length > 300 ? ' (300건까지 표시)' : ''}</span>
              <button type="button" onClick={() => setSel(new Set(shown.map(d => d.id)))} disabled={!shown.length} className="border border-slate-300 rounded px-2 py-1 hover:bg-slate-50 disabled:opacity-40">표시된 것 모두 선택</button>
              <button type="button" onClick={() => setSel(new Set())} className="border border-slate-300 rounded px-2 py-1 hover:bg-slate-50">선택 해제</button>
              <button type="button" onClick={apply} disabled={busy || sel.size === 0} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 font-bold disabled:opacity-40">{busy ? '보정 중…' : `선택 ${sel.size}개 보정`}</button>
            </div>
            {msg && <p className={msg.startsWith('오류') ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>{msg}</p>}
            {rows.length === 0 ? <p className="text-slate-500 py-6 text-center">{data.불일치 === 0 ? '모든 품목이 전표와 일치합니다.' : '조건에 맞는 불일치 품목이 없습니다.'}</p> : (
              <div className="max-h-[48vh] overflow-auto"><table className="w-full border-collapse">
                <thead><tr className="bg-slate-50 text-slate-500 border-b sticky top-0">
                  <th className="p-1 w-6" /><th className="p-1 text-left">품명</th><th className="p-1 text-left">규격</th><th className="p-1">단위</th>
                  <th className="p-1 text-right">이월</th><th className="p-1 text-right">전표 증감</th><th className="p-1 text-right">다시 센 재고</th><th className="p-1 text-right">현재고</th><th className="p-1 text-right">차이</th><th className="p-1">구분</th>
                </tr></thead>
                <tbody>{shown.map(d => (
                  <tr key={d.id} className="border-b border-slate-100 hover:bg-blue-50/40">
                    <td className="p-1 text-center"><input type="checkbox" checked={sel.has(d.id)} onChange={e => { const s = new Set(sel); e.target.checked ? s.add(d.id) : s.delete(d.id); setSel(s); }} /></td>
                    <td className="p-1">{d.name}</td><td className="p-1 text-slate-500">{d.spec}</td><td className="p-1 text-center">{d.unit}</td>
                    <td className="p-1 text-right font-mono">{n(d.opening)}</td><td className="p-1 text-right font-mono">{n(d.moved)}</td><td className="p-1 text-right font-mono font-bold">{n(d.expected)}</td><td className="p-1 text-right font-mono">{n(d.current)}</td>
                    <td className={`p-1 text-right font-mono font-bold ${d.diff > 0 ? 'text-rose-600' : 'text-blue-600'}`}>{d.diff > 0 ? '+' : ''}{n(d.diff)}</td>
                    <td className="p-1 text-center text-slate-500">{d.kind === 'noSlips' ? '전표 없음' : '전표 있음'}</td>
                  </tr>))}
                </tbody></table></div>
            )}
          </>}
        </div>
      </div>
    </div>
  );
}
