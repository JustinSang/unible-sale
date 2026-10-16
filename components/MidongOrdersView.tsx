'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Link2 } from 'lucide-react';
import type { Slip } from '@/types';

// (주)미동이엔씨 파트너 포털 자재마감 «월별 품목 내역» — 발주·입고 줄 단위 원장 + 우리 ERP 매출 대조 + 수주 전표 가져오기.
// 포털에서 읽은 줄은 scripts/import_midong_orders.py로 적재한다(읽기 전용 수집, 쓰기 없음).
interface Line { id: string; closeYm: string; rno: string; site: string; name: string; spec: string; unit: string; ordQty: number; price: number; ordAmt: number; inQty: number; inAmt: number; inDate: string; closeDate: string }
const won = (n: number) => Math.round(n || 0).toLocaleString('ko-KR');
const th = 'px-2 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 border border-slate-200 whitespace-nowrap';
const td = 'px-2 py-1 text-xs border border-slate-200';
const num = `${td} text-right font-mono`;
const PAGE = 300;

export function MidongOrdersView({ slips, onSlipsChanged }: { slips: Slip[]; onSlipsChanged?: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [year, setYear] = useState('all');
  const [ym, setYm] = useState('all');
  const [q, setQ] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<'lines' | 'months' | 'import' | 'convert'>('lines');
  const [cvFrom, setCvFrom] = useState('2020-01-01');
  const [cvTo, setCvTo] = useState('2023-12-31');
  const [cvSettle, setCvSettle] = useState<'paid' | 'unpaid'>('paid');
  const [cvPrev, setCvPrev] = useState<any>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [listYear, setListYear] = useState('2023');
  const [from, setFrom] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/midong-orders');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || String(res.status));
      setLines(Array.isArray(data) ? data : []); setState('ok');
    } catch (e: any) { setErr(e.message || String(e)); setState('error'); }
  };
  useEffect(() => { load(); }, []);

  const years = useMemo(() => [...new Set(lines.map(l => l.closeYm.slice(0, 4)))].sort().reverse(), [lines]);
  const months = useMemo(() => [...new Set(lines.filter(l => year === 'all' || l.closeYm.startsWith(year)).map(l => l.closeYm))].sort().reverse(), [lines, year]);
  const filtered = useMemo(() => {
    const t = q.trim();
    return lines.filter(l => (year === 'all' || l.closeYm.startsWith(year)) && (ym === 'all' || l.closeYm === ym) && (!onlyDiff || l.inQty !== l.ordQty) && (!t || `${l.rno} ${l.site} ${l.name} ${l.spec}`.includes(t)))
      .sort((a, b) => b.closeYm.localeCompare(a.closeYm) || b.inDate.localeCompare(a.inDate) || a.rno.localeCompare(b.rno));
  }, [lines, year, ym, q, onlyDiff]);
  const tot = useMemo(() => ({ n: filtered.length, rno: new Set(filtered.map(l => l.rno)).size, ord: filtered.reduce((a, l) => a + l.ordAmt, 0), inn: filtered.reduce((a, l) => a + l.inAmt, 0) }), [filtered]);

  // 달력 월(입고일 기준) 포털 입고 vs ERP 미동 매출(전표 일자 기준, 반품 차감)
  const recon = useMemo(() => {
    const por = new Map<string, { amt: number; n: number }>(); const erp = new Map<string, { amt: number; n: number }>();
    lines.forEach(l => { if (!l.inDate) return; const k = l.inDate.slice(0, 7); const v = por.get(k) || { amt: 0, n: 0 }; v.amt += l.inAmt; v.n++; por.set(k, v); });
    slips.forEach(s => {
      if (!String(s.customerName).includes('미동')) return;
      const t = String(s.slipType).toLowerCase(); if (t === 'contract' || t === 'estimate' || t === 'order' || t === 'delivery') return;
      const sign = t.startsWith('return') ? -1 : 1; const k = s.slipDate.slice(0, 7); const v = erp.get(k) || { amt: 0, n: 0 }; v.amt += sign * s.totalAmount; v.n++; erp.set(k, v);
    });
    const keys = [...new Set([...por.keys(), ...erp.keys()])].filter(k => year === 'all' || k.startsWith(year)).sort().reverse();
    return keys.map(k => ({ k, pa: por.get(k)?.amt || 0, pn: por.get(k)?.n || 0, ea: erp.get(k)?.amt || 0, en: erp.get(k)?.n || 0 }));
  }, [lines, slips, year]);
  const lastErp = useMemo(() => slips.filter(s => String(s.customerName).includes('미동') && !['contract', 'estimate', 'order', 'delivery'].includes(String(s.slipType).toLowerCase())).reduce((m, s) => (s.slipDate > m ? s.slipDate : m), ''), [slips]);
  useEffect(() => { if (!from && lastErp) { const d = new Date(lastErp); d.setDate(d.getDate() + 1); setFrom(d.toISOString().slice(0, 10)); } }, [lastErp, from]);

  const exportExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const rows = filtered.map(l => ({ 마감월: `${l.closeYm.slice(0, 4)}-${l.closeYm.slice(4)}`, 청구번호: l.rno, 현장: l.site, 품명: l.name, 규격: l.spec, 단위: l.unit, 발주수량: l.ordQty, 단가: l.price, 발주금액: l.ordAmt, 입고수량: l.inQty, 입고금액: l.inAmt, 입고일: l.inDate, 마감일: l.closeDate }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '품목(입고 기준)');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recon.map(r => ({ 월: r.k, 포털입고금액: r.pa, 포털줄수: r.pn, ERP미동매출: r.ea, ERP전표수: r.en, 차이: r.pa - r.ea }))), 'ERP 대조(달력 월)');
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'application/octet-stream' }));
    a.download = `미동발주내역_${year === 'all' ? '전체' : year}${ym !== 'all' ? '_' + ym : ''}_${new Date().toISOString().slice(0, 10)}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  const runImport = async (dryRun: boolean) => {
    setBusy(dryRun ? '확인 중' : '만드는 중'); setMsg('');
    try {
      const res = await fetch('/api/midong-orders/import-slips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, dryRun }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || String(res.status));
      if (dryRun) setPreview(data); else { setPreview(null); setMsg(`수주 전표 ${data.만들_수주전표}건을 만들었습니다(이미 있던 ${data.이미_있음}건은 그대로).`); onSlipsChanged?.(); }
    } catch (e: any) { setMsg(`오류: ${e.message || e}`); } finally { setBusy(''); }
  };

  // 매출 전환·정산: 범위(from~to) 또는 선택 전표(ids)에 적용. dryRun이면 미리보기만.
  const runConvert = async (action: string, dryRun: boolean, ids?: string[]) => {
    setBusy(dryRun ? '확인 중' : '처리 중'); setMsg('');
    try {
      const body: any = { action, settle: cvSettle, dryRun, ...(ids ? { ids } : { from: cvFrom, to: cvTo }) };
      const res = await fetch('/api/midong-orders/convert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error || String(res.status));
      if (dryRun) setCvPrev({ ...data, ids }); else { setCvPrev(null); setSel(new Set()); setMsg(`${data.대상}건 처리 완료 (금액 ${won(data.금액합계)}원 · 미수금 변화 ${won(data.미수금_변화)}원)`); onSlipsChanged?.(); }
    } catch (e: any) { setMsg(`오류: ${e.message || e}`); } finally { setBusy(''); }
  };
  const mos = useMemo(() => slips.filter(s => String(s.id).startsWith('mos-')), [slips]);
  const mosYears = useMemo(() => [...new Set(mos.map(s => s.slipDate.slice(0, 4)))].sort().reverse(), [mos]);
  const mosRows = useMemo(() => mos.filter(s => s.slipDate.startsWith(listYear)).sort((a, b) => a.slipDate.localeCompare(b.slipDate)).slice(0, 400), [mos, listYear]);
  const mosStat = (y: string) => { const r = mos.filter(s => s.slipDate.startsWith(y)); return { n: r.length, sales: r.filter(s => s.slipType === 'SALES').length, unpaid: r.reduce((a, s) => a + (s.slipType === 'SALES' ? Number(s.unpaidAmount) || 0 : 0), 0), amt: r.reduce((a, s) => a + (Number(s.totalAmount) || 0), 0) }; };

  if (state === 'loading') return <p className="text-sm text-slate-500 p-6">미동 발주내역을 불러오는 중…</p>;
  if (state === 'error') return <p className="text-sm text-red-600 p-6">불러오지 못했습니다: {err} <button className="ml-2 underline" onClick={load}>다시 시도</button></p>;
  if (lines.length === 0) return <div className="p-6 text-sm text-slate-600 space-y-2"><p><b>아직 적재된 미동 발주내역이 없습니다.</b></p><p>포털(partner.midong.com)에서 읽은 자료를 <code>scripts/import_midong_orders.py</code>로 적재하면 이 화면에 나타납니다.</p></div>;

  const pageRows = filtered.slice(page * PAGE, (page + 1) * PAGE);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link2 className="w-4 h-4 text-blue-600" />
        <b className="text-sm text-slate-800">(주)미동이엔씨 발주내역</b>
        <span className="text-slate-500">partner.midong.com 자재마감 월별 품목 내역 · {won(lines.length)}줄 · {years[years.length - 1]}~{years[0]}</span>
        <button onClick={load} className="ml-auto flex items-center gap-1 border border-slate-300 rounded px-2 py-1 hover:bg-slate-50"><RefreshCw className="w-3 h-3" /> 새로고침</button>
        <button onClick={exportExcel} className="flex items-center gap-1 border border-emerald-300 text-emerald-700 rounded px-2 py-1 hover:bg-emerald-50 font-semibold"><Download className="w-3 h-3" /> 엑셀로 내보내기(현재 조건)</button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {([['lines', '발주·입고 줄'], ['months', 'ERP 매출과 월별 대조'], ['import', '수주 전표로 가져오기'], ['convert', '매출 전환·정산']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} className={`px-3 py-1.5 rounded border font-semibold ${mode === k ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{l}</button>
        ))}
        <select value={year} onChange={e => { setYear(e.target.value); setYm('all'); setPage(0); }} className="border border-slate-300 rounded px-2 py-1 ml-2"><option value="all">전체 연도</option>{years.map(y => <option key={y} value={y}>{y}년</option>)}</select>
        {mode === 'lines' && <>
          <select value={ym} onChange={e => { setYm(e.target.value); setPage(0); }} className="border border-slate-300 rounded px-2 py-1"><option value="all">전체 마감월</option>{months.map(m => <option key={m} value={m}>{m.slice(0, 4)}-{m.slice(4)}</option>)}</select>
          <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="청구번호·현장·품명·규격" className="border border-slate-300 rounded px-2 py-1 w-52" />
          <label className="flex items-center gap-1"><input type="checkbox" checked={onlyDiff} onChange={e => { setOnlyDiff(e.target.checked); setPage(0); }} /> 발주≠입고만</label>
        </>}
      </div>

      {mode === 'lines' && (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs bg-slate-50 border border-slate-200 rounded px-3 py-2">
            <span><b>{won(tot.n)}</b>줄</span><span>청구번호 <b>{won(tot.rno)}</b>건</span><span>발주금액 <b className="font-mono">{won(tot.ord)}</b></span><span>입고금액 <b className="font-mono text-blue-700">{won(tot.inn)}</b></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr>{['마감월', '청구번호', '현장', '품명', '규격', '단위', '발주수량', '단가', '발주금액', '입고수량', '입고금액', '입고일'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {pageRows.map(l => (
                  <tr key={l.id} className={l.inQty !== l.ordQty ? 'bg-amber-50' : ''}>
                    <td className={td}>{l.closeYm.slice(0, 4)}-{l.closeYm.slice(4)}</td><td className={`${td} font-mono`}>{l.rno}</td><td className={`${td} max-w-[220px] truncate`} title={l.site}>{l.site}</td><td className={td}>{l.name}</td><td className={td}>{l.spec}</td><td className={td}>{l.unit}</td>
                    <td className={num}>{l.ordQty}</td><td className={num}>{won(l.price)}</td><td className={num}>{won(l.ordAmt)}</td><td className={num}>{l.inQty}</td><td className={num}>{won(l.inAmt)}</td><td className={`${td} font-mono`}>{l.inDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="border border-slate-300 rounded px-2 py-1 disabled:opacity-40">이전</button>
            <span>{page + 1} / {Math.max(1, Math.ceil(filtered.length / PAGE))}쪽 ({PAGE}줄씩)</span>
            <button disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage(p => p + 1)} className="border border-slate-300 rounded px-2 py-1 disabled:opacity-40">다음</button>
            <span className="text-slate-400">엑셀로 내보내기는 현재 조건의 전체 줄을 담습니다.</span>
          </div>
        </>
      )}

      {mode === 'months' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">포털 입고금액(입고일의 달력 월)과 우리 ERP의 미동 매출(전표 일자 월, 반품 차감)을 비교합니다. 마감 주기(21일~20일)와 달력 월이 달라 한 달 단위로는 어긋날 수 있으니 흐름을 보세요. ERP 마지막 미동 매출 전표일: <b>{lastErp || '없음'}</b></p>
          <div className="overflow-x-auto"><table className="w-full border-collapse">
            <thead><tr>{['월', '포털 입고금액', '포털 줄', 'ERP 미동 매출', 'ERP 전표', '차이(포털−ERP)'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>{recon.map(r => <tr key={r.k} className={r.en === 0 && r.pn > 0 ? 'bg-rose-50' : ''}><td className={`${td} font-mono`}>{r.k}</td><td className={num}>{won(r.pa)}</td><td className={num}>{r.pn}</td><td className={num}>{won(r.ea)}</td><td className={num}>{r.en}</td><td className={`${num} font-bold`}>{won(r.pa - r.ea)}</td></tr>)}</tbody>
          </table></div>
        </div>
      )}

      {mode === 'import' && (
        <div className="space-y-3 text-xs">
          <p className="text-slate-700">포털의 발주(청구번호 단위)를 우리 ERP의 <b>수주 전표</b>로 가져옵니다. 수주 전표는 <b>외상미수금·재고를 바꾸지 않습니다</b>(납품·매출 전환은 기존 «납품서로 변환» 흐름). 청구번호마다 전표 번호가 정해져 있어 <b>다시 눌러도 중복되지 않고</b>, 이미 있는 전표는 건드리지 않습니다. 포털에는 발주일이 없어 <b>가장 이른 입고일</b>을 전표 일자로 씁니다.</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="font-semibold">이 일자부터</label>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreview(null); }} className="border border-slate-300 rounded px-2 py-1" />
            <span className="text-slate-500">(기본: ERP 마지막 미동 매출일 다음 날)</span>
            <button onClick={() => runImport(true)} disabled={!!busy || !from} className="border border-blue-300 text-blue-700 rounded px-3 py-1 hover:bg-blue-50 font-semibold disabled:opacity-50">{busy === '확인 중' ? '확인 중…' : '먼저 확인(만들지 않음)'}</button>
          </div>
          {preview && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-1">
              <p>청구번호 <b>{preview.청구번호}</b>건 중 <b>{preview.만들_수주전표}</b>건을 수주 전표로 만듭니다 (발주금액 합계 <b className="font-mono">{won(preview.발주금액합계)}</b> · 이미 있음 {preview.이미_있음} · {from} 이전 {preview.시작일_이전})</p>
              {(preview.미리보기 || []).map((p: any) => <p key={p.slipNo} className="font-mono text-slate-600">{p.slipDate} {p.slipNo} {p.site} · {p.items}품목 {won(p.total)}원</p>)}
              <button onClick={() => runImport(false)} disabled={!!busy || preview.만들_수주전표 === 0} className="mt-1 bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 font-bold disabled:opacity-50">{busy === '만드는 중' ? '만드는 중…' : `수주 전표 ${preview.만들_수주전표}건 만들기`}</button>
            </div>
          )}
        </div>
      )}
      {mode === 'convert' && (
        <div className="space-y-3 text-xs">
          <p className="text-slate-700">수주 전표(<code>mos-</code>)를 <b>매출 전표</b>로 바꾸거나 정산 상태를 고칩니다. 언제든 되돌릴 수 있습니다. 포털에 결제금액이 없어 <b>정산완료/미수는 대표님이 정하는 값</b>입니다. 2024년 이후는 ERP 미동 매출과 겹칠 수 있으니 <b>먼저 확인</b>의 «같은 기간 ERP 미동 매출 건수»를 보세요.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={cvFrom} onChange={e => { setCvFrom(e.target.value); setCvPrev(null); }} className="border border-slate-300 rounded px-2 py-1" /> ~
            <input type="date" value={cvTo} onChange={e => { setCvTo(e.target.value); setCvPrev(null); }} className="border border-slate-300 rounded px-2 py-1" />
            <select value={cvSettle} onChange={e => { setCvSettle(e.target.value as any); setCvPrev(null); }} className="border border-slate-300 rounded px-2 py-1"><option value="paid">전환 시 정산완료</option><option value="unpaid">전환 시 미수(외상)</option></select>
            <button onClick={() => runConvert('toSales', true)} disabled={!!busy} className="border border-blue-300 text-blue-700 rounded px-3 py-1 hover:bg-blue-50 font-semibold disabled:opacity-50">매출 전환 먼저 확인</button>
            <button onClick={() => runConvert('toContract', true)} disabled={!!busy} className="border border-slate-300 text-slate-600 rounded px-3 py-1 hover:bg-slate-50 font-semibold disabled:opacity-50">이 기간 수주로 되돌리기 확인</button>
          </div>
          <table className="border-collapse"><thead><tr><th className={th}>연도</th><th className={th}>수주 전표</th><th className={th}>매출 전환됨</th><th className={th}>발주 합계</th><th className={th}>미수 잔액</th></tr></thead>
            <tbody>{mosYears.map(y => { const t = mosStat(y); return <tr key={y}><td className={td}>{y}</td><td className={num}>{t.n}</td><td className={num}>{t.sales}</td><td className={num}>{won(t.amt)}</td><td className={num}>{won(t.unpaid)}</td></tr>; })}</tbody></table>
          {cvPrev && (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-1">
              <p><b>{cvPrev.대상}</b>건 · 금액 <b className="font-mono">{won(cvPrev.금액합계)}</b> · 거래처 미수금 변화 <b className="font-mono">{won(cvPrev.미수금_변화)}</b>원 · 유형 불일치로 건너뜀 {cvPrev.건너뜀_유형불일치}{cvPrev.action === 'toSales' && <> · 같은 기간 ERP 미동 매출 <b className={cvPrev.ERP_기존_미동매출_같은기간 > 0 ? 'text-red-600' : ''}>{cvPrev.ERP_기존_미동매출_같은기간}건</b>{cvPrev.ERP_기존_미동매출_같은기간 > 0 && ' (이중계상 가능)'}</>}</p>
              <button onClick={() => runConvert(cvPrev.action, false, cvPrev.ids)} disabled={!!busy || cvPrev.대상 === 0} className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 font-bold disabled:opacity-50">{busy === '처리 중' ? '처리 중…' : `${cvPrev.대상}건 실행`}</button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
            <b>전표별 수정</b>
            <select value={listYear} onChange={e => { setListYear(e.target.value); setSel(new Set()); }} className="border border-slate-300 rounded px-2 py-1">{mosYears.map(y => <option key={y} value={y}>{y}년</option>)}</select>
            <span className="text-slate-500">선택 {sel.size}건 (표는 400건까지)</span>
            {([['settle', '정산완료로'], ['unsettle', '미수로'], ['toSales', '매출로 전환'], ['toContract', '수주로 되돌리기']] as const).map(([a, l]) => (
              <button key={a} onClick={() => runConvert(a, true, [...sel])} disabled={!!busy || sel.size === 0} className="border border-slate-300 rounded px-2 py-1 hover:bg-slate-50 font-semibold disabled:opacity-40">{l}</button>
            ))}
          </div>
          <div className="max-h-96 overflow-auto"><table className="border-collapse w-full"><thead><tr><th className={th}><input type="checkbox" checked={mosRows.length > 0 && mosRows.every(s => sel.has(s.id))} onChange={e => setSel(e.target.checked ? new Set(mosRows.map(s => s.id)) : new Set())} /></th><th className={th}>일자</th><th className={th}>전표번호</th><th className={th}>현장</th><th className={th}>금액</th><th className={th}>상태</th></tr></thead>
            <tbody>{mosRows.map(s => <tr key={s.id}><td className={td}><input type="checkbox" checked={sel.has(s.id)} onChange={e => { const n = new Set(sel); e.target.checked ? n.add(s.id) : n.delete(s.id); setSel(n); }} /></td><td className={td}>{s.slipDate}</td><td className={`${td} font-mono`}>{s.slipNo}</td><td className={td}>{(s as any).siteName}</td><td className={num}>{won(Number(s.totalAmount))}</td><td className={td}>{s.slipType !== 'SALES' ? '수주' : (Number(s.unpaidAmount) > 0 ? '매출·미수' : '매출·정산완료')}</td></tr>)}</tbody></table></div>
        </div>
      )}
      {msg && <p className={`text-xs font-semibold ${msg.startsWith('오류') ? 'text-red-600' : 'text-emerald-700'}`}>{msg}</p>}
    </div>
  );
}
