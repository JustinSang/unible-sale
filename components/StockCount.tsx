'use client';

// 재고 실사(일괄): 품목을 골라 «실사수량»을 넣으면 장부수량과의 차이를 보여 주고, 확인하면 차이만큼 재고를 조정한다.
// 이카운트 «재고조정진행단계»(장부수량·실사수량·차이 → 조정)의 흐름을 같은 순서로 만든 것이다(근거: docs/analysis_rea/ecount/ecount_거래처_품목_단가_REA분석_2026-10-17.md 부록).
// 조정은 기존 /api/stock-adjust 를 그대로 쓴다(변경 이력·재고 기록 남음). 장부수량은 «지금 시점 재고»를 매번 다시 읽어 차이를 구한다.
// 지름길: 한 번에 수백 건을 순서대로 보낸다(동시 전표 입력과 겹칠 일이 없는 사무 시간 외 사용 권장).
import React, { useMemo, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Product } from '@/types';

const n = (v: number) => (v || 0).toLocaleString('ko-KR');

export function StockCountModal({ products, onClose, onRefresh }: {
  products: Product[]; onClose: () => void; onRefresh?: () => Promise<void> | void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [reason, setReason] = useState(`재고 실사 차이 조정 (${new Date().toISOString().slice(0, 10)})`);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const hits = useMemo(() => {
    const k = q.trim().replace(/\s/g, '').toLowerCase();
    if (!k) return [];
    const out: Product[] = [];
    for (const p of products) {
      if (p.inactive || ids.includes(p.id)) continue;
      if (`${p.name}${p.spec}${p.code}${p.barcode || ''}${p.nickName || ''}`.replace(/\s/g, '').toLowerCase().includes(k)) { out.push(p); if (out.length >= 30) break; }
    }
    return out;
  }, [q, products, ids]);

  const add = (id: string) => setIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  const addAllWithStock = () => setIds(products.filter(p => !p.inactive && (p.currentStock || 0) !== 0).map(p => p.id));
  const remove = (id: string) => { setIds(prev => prev.filter(x => x !== id)); setCounted(c => { const m = { ...c }; delete m[id]; return m; }); };

  const rows = ids.map(id => byId.get(id)).filter((p): p is Product => !!p).map(p => {
    const raw = counted[p.id];
    const has = raw !== undefined && raw.trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) >= 0;
    const book = p.currentStock || 0;
    return { p, book, has, count: has ? Number(raw) : 0, diff: has ? Number(raw) - book : 0 };
  });
  const diffRows = rows.filter(r => r.has && r.diff !== 0);

  const apply = async () => {
    if (diffRows.length === 0 || busy) return;
    if (!window.confirm(`차이가 있는 ${diffRows.length}개 품목의 재고를 실사수량으로 조정합니다.\n(+ ${diffRows.filter(r => r.diff > 0).length}건 · − ${diffRows.filter(r => r.diff < 0).length}건)\n되돌리려면 반대 조정을 다시 해야 합니다. 진행할까요?`)) return;
    setBusy(true); setMsg('');
    let ok = 0; const fail: string[] = [];
    for (const r of diffRows) {
      try {
        const res = await fetch('/api/stock-adjust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: r.p.id, adjustQty: r.diff, reason }) });
        if (res.ok) ok++; else fail.push(r.p.name);
      } catch { fail.push(r.p.name); }
    }
    if (onRefresh) await onRefresh();
    setBusy(false);
    setCounted({});
    setMsg(`${ok}건 조정 완료${fail.length ? ` · 실패 ${fail.length}건(${fail.slice(0, 3).join(', ')}${fail.length > 3 ? ' 외' : ''})` : ''}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50 rounded-t-lg">
          <b className="text-sm">재고 실사 (장부수량 ↔ 실사수량 → 차이 조정)</b>
          <button type="button" onClick={onClose} aria-label="닫기"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 text-xs overflow-y-auto">
          <div className="flex gap-2 mb-2">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="품명·규격·코드·바코드로 찾아 담기" className="flex-1 border rounded px-2 py-1.5" />
            <button type="button" onClick={addAllWithStock} className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 whitespace-nowrap">재고 있는 품목 모두 담기</button>
          </div>
          {hits.length > 0 && (
            <div className="border rounded mb-2 max-h-40 overflow-y-auto">
              {hits.map(p => (
                <button key={p.id} type="button" onClick={() => add(p.id)} className="w-full text-left px-2 py-1 hover:bg-blue-50 flex justify-between border-b border-slate-100">
                  <span>{p.name} <span className="text-slate-500">{p.spec}</span></span><span className="text-slate-400">재고 {n(p.currentStock)}</span>
                </button>
              ))}
            </div>
          )}
          {rows.length === 0 ? <p className="text-slate-500 py-8 text-center">실사할 품목을 찾아 담으세요.</p> : (
            <table className="w-full border-collapse">
              <thead><tr className="bg-slate-50 text-slate-500 border-b">
                <th className="p-1 text-left">품명</th><th className="p-1 text-left">규격</th><th className="p-1">단위</th>
                <th className="p-1 text-right">장부수량</th><th className="p-1 text-right w-28">실사수량</th><th className="p-1 text-right">차이</th><th className="p-1 w-6" />
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.p.id} className="border-b border-slate-100">
                    <td className="p-1">{r.p.name}</td><td className="p-1">{r.p.spec}</td><td className="p-1 text-center">{r.p.unit}</td>
                    <td className="p-1 text-right font-mono">{n(r.book)}</td>
                    <td className="p-1 text-right"><input type="number" min={0} value={counted[r.p.id] ?? ''} onChange={e => setCounted(c => ({ ...c, [r.p.id]: e.target.value }))} className="w-24 border rounded px-1.5 py-0.5 text-right font-mono" /></td>
                    <td className={`p-1 text-right font-mono font-bold ${!r.has ? 'text-slate-300' : r.diff > 0 ? 'text-blue-600' : r.diff < 0 ? 'text-rose-600' : 'text-slate-500'}`}>{r.has ? (r.diff > 0 ? '+' : '') + n(r.diff) : '-'}</td>
                    <td className="p-1"><button type="button" onClick={() => remove(r.p.id)} className="text-slate-400 hover:text-rose-600" aria-label="빼기"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="border-t px-4 py-2.5 flex flex-wrap items-center gap-2 text-xs bg-slate-50 rounded-b-lg">
          <input value={reason} onChange={e => setReason(e.target.value)} className="flex-1 min-w-56 border rounded px-2 py-1.5" aria-label="조정 사유" />
          <span className="text-slate-500">입력 {rows.filter(r => r.has).length}/{rows.length} · 차이 {diffRows.length}건</span>
          <button type="button" disabled={diffRows.length === 0 || busy} onClick={apply} className="px-4 py-1.5 rounded bg-blue-600 text-white font-semibold disabled:opacity-40">
            {busy ? '조정 중…' : `차이 ${diffRows.length}건 조정 반영`}
          </button>
          {msg && <span className="w-full text-emerald-700 font-semibold">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
