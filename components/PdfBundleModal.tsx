'use client';

import React, { useMemo, useState } from 'react';
import { FileText, X, Download } from 'lucide-react';
import type { Slip, SystemConfig, Customer } from '@/types';
import { askSaveHandle, safeName } from '@/lib/pdfExport';
import { normSlipType, SLIP_TYPE_LABEL } from '@/lib/slipType';

// 인쇄 양식 PDF 묶음 — 고른 전표들을 «원본 양식»(거래명세표 2단·견적서·발주서)으로 한 PDF 파일에 묶는다.
// 전표마다 새 쪽에서 시작하고, 정렬은 «일자순» 또는 «거래처순».
const TYPE_LABEL = SLIP_TYPE_LABEL;
const won = (n: number) => Math.round(n || 0).toLocaleString('ko-KR');

export function PdfBundleModal({ slips, config, customers, onClose }: { slips: Slip[]; config: SystemConfig; customers: Customer[]; onClose: () => void }) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(slips.map(s => s.id)));
  const [types, setTypes] = useState<Set<string>>(() => new Set(slips.map(s => normSlipType(s.slipType))));
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'date' | 'customer'>('date');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const typeCounts = useMemo(() => { const m = new Map<string, number>(); slips.forEach(s => { const t = normSlipType(s.slipType); m.set(t, (m.get(t) || 0) + 1); }); return [...m.entries()]; }, [slips]);
  const shown = useMemo(() => {
    const t = q.trim();
    const list = slips.filter(s => types.has(normSlipType(s.slipType)) && (!t || `${s.slipNo} ${s.customerName} ${s.siteName || ''}`.includes(t)));
    return list.sort((a, b) => sort === 'date' ? a.slipDate.localeCompare(b.slipDate) || a.slipNo.localeCompare(b.slipNo) : a.customerName.localeCompare(b.customerName, 'ko') || a.slipDate.localeCompare(b.slipDate));
  }, [slips, types, q, sort]);
  const chosen = shown.filter(s => picked.has(s.id));
  const estPages = chosen.reduce((a, s) => a + Math.max(1, Math.ceil((s.items?.length || 0) / ((normSlipType(s.slipType) === 'ESTIMATE' || normSlipType(s.slipType) === 'ORDER') ? 36 : 16))), 0);

  const toggle = (id: string) => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = shown.length > 0 && shown.every(s => picked.has(s.id));
  const setAll = (on: boolean) => setPicked(p => { const n = new Set(p); shown.forEach(s => (on ? n.add(s.id) : n.delete(s.id))); return n; });

  const run = async () => {
    if (chosen.length === 0) { setMsg('전표를 하나 이상 고르세요.'); return; }
    const dates = chosen.map(s => s.slipDate).sort();
    const range = dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]}~${dates[dates.length - 1]}`;
    const name = `${safeName(`전표묶음_${range}_${chosen.length}건`)}.pdf`;
    try {
      const handle = await askSaveHandle(name);
      if (handle === null) { setMsg('저장을 취소했습니다.'); return; }
      setBusy('준비 중'); setMsg('');
      const { exportSlipsPdf } = await import('@/lib/pdfJobs');
      const r = await exportSlipsPdf({ slips: chosen, config, customers, filename: name, handle, onProgress: p => setBusy(`${p.done}/${p.total}건 · ${p.label}`) });
      setMsg(`저장 완료 — ${chosen.length}건 · ${r.pages}쪽 · ${(r.bytes / 1024).toFixed(0)}KB (${name})`);
    } catch (e: any) {
      console.error(e); setMsg(`PDF 만드는 중 오류: ${e?.message || e}`);
    } finally { setBusy(''); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-lg">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-600" /> 인쇄 양식 PDF 묶음 — 원본 양식으로 한 파일에</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded" aria-label="닫기"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-3 border-b border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="전표번호·거래처·현장 검색" className="border border-slate-300 rounded px-2 py-1 w-52" />
          {typeCounts.map(([t, n]) => (
            <label key={t} className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer ${types.has(t) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500'}`}>
              <input type="checkbox" checked={types.has(t)} onChange={() => setTypes(p => { const nx = new Set(p); nx.has(t) ? nx.delete(t) : nx.add(t); return nx; })} />
              {TYPE_LABEL[t] || t} {n}
            </label>
          ))}
          <select value={sort} onChange={e => setSort(e.target.value as 'date' | 'customer')} className="border border-slate-300 rounded px-2 py-1 ml-auto">
            <option value="date">일자순</option>
            <option value="customer">거래처순</option>
          </select>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="px-2 py-1.5 w-8"><input type="checkbox" checked={allOn} onChange={e => setAll(e.target.checked)} aria-label="전체 선택" /></th>
                {['일자', '구분', '전표번호', '거래처', '현장', '품목', '합계'].map(h => <th key={h} className="px-2 py-1.5 text-left font-bold text-slate-600 border-b border-slate-200 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {shown.map(s => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => toggle(s.id)}>
                  <td className="px-2 py-1"><input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} onClick={e => e.stopPropagation()} /></td>
                  <td className="px-2 py-1 font-mono">{s.slipDate}</td>
                  <td className="px-2 py-1">{TYPE_LABEL[normSlipType(s.slipType)] || s.slipType}</td>
                  <td className="px-2 py-1 font-mono">{s.slipNo}</td>
                  <td className="px-2 py-1 font-semibold">{s.customerName}</td>
                  <td className="px-2 py-1 text-slate-500">{s.siteName || ''}</td>
                  <td className="px-2 py-1 text-right">{s.items?.length || 0}</td>
                  <td className="px-2 py-1 text-right font-mono">{won(s.totalAmount)}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={8} className="px-2 py-8 text-center text-slate-400">조건에 맞는 전표가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-slate-200 bg-slate-50 rounded-b-lg flex flex-wrap items-center gap-3 text-xs">
          <span className="text-slate-600">선택 <b>{chosen.length}</b>건 · 약 <b>{estPages}</b>쪽 (거래명세표는 한 쪽에 위·아래 두 벌, 16줄 넘으면 다음 쪽)</span>
          {msg && <span className={`font-semibold ${msg.includes('오류') ? 'text-red-600' : 'text-emerald-700'}`}>{msg}</span>}
          <button onClick={run} disabled={!!busy || chosen.length === 0} className="ml-auto px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> {busy ? busy : 'PDF 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
}
