'use client';

import React from 'react';
import { Printer, X } from 'lucide-react';
import layouts from '@/lib/rptLayouts.json';

// 오케이세일(머니플러스) 보고서(.rpt) 인쇄 양식 — 원본 파일을 해독해 복원한 구역·좌표·글꼴을 그대로 쓴다.
// 근거: docs/analysis_rea/oksale/reports/rpt_layout.py (스키마 0x07xx 레코드 트리, 누적 XOR 마스크) → lib/rptLayouts.json.
// 구역 역할: ph(쪽 머리·제목) · ch(열 머리) · detail(줄 반복) · rf(보고서 끝 선) · pf(쪽 바닥, 상호). 단위 twip(1/1440인치).
// 지름길: 선 굵기·글꼴(굴림체 대체)·0 값 표시 방식·숫자 칸 정렬(필드 이름으로 추정)·쪽 아래 여백은 원본에서 못 읽어 추정한다.
type Obj = { k: 't' | 'f' | 'l'; l: number; t: number; w: number; h: number; x?: string; r?: string; s?: number; b?: number; a?: number; box?: number };
type Sec = { role: 'ph' | 'ch' | 'detail' | 'rf' | 'pf'; h: number; o: Obj[] };
type Layout = { landscape: boolean; sections: Sec[] };
const LAYOUTS = layouts as unknown as Record<string, Layout>;

const MM = 0.017639;
const tw = (n: number) => `${(n * MM).toFixed(2)}mm`;
const BOTTOM_MARGIN = 500;
const NUMERIC = /Amount|Qty|Price|Balance|Tax|Total|Debit|Credit|Cost|Rate|Benefit|Receipt\d?$|Month\d|Stock/i;
const won = (n: number) => Math.round(n).toLocaleString('ko-KR');

export type RptRow = Record<string, string | number | null | undefined>;
export const RPT_KEYS = Object.keys(LAYOUTS);

function Page({ lay, pageNo, pages, rows, firstRowNo, params, isLast, w, h, rfOnly }: { lay: Layout; pageNo: number; pages: number; rows: RptRow[]; firstRowNo: number; params: Record<string, string>; isLast: boolean; w: number; h: number; rfOnly?: boolean }) {
  const sec = (role: Sec['role']) => lay.sections.filter(s => s.role === role);
  const heads = [...sec('ph'), ...sec('ch')];
  const det = sec('detail')[0];
  const rf = sec('rf')[0];
  const pf = sec('pf')[0];
  const today = new Date().toISOString().slice(0, 10);
  const sub = (txt: string) => txt.replace(/\{@(\w+)\}/g, (_, k) => params[k] ?? '');
  const val = (o: Obj, row?: RptRow, rowNo?: number, inDetail?: boolean): { text: string; right: boolean } => {
    const ref = o.r || '';
    if (ref.startsWith('@')) return { text: params[ref.slice(1)] ?? '', right: false };
    if (ref.startsWith('User.')) return { text: params[ref] ?? '', right: false };
    const name = ref.split('.').pop() || '';
    if (name === 'Total Page Count') return { text: String(pages), right: false };
    if (name === 'PageNumber') return { text: String(pageNo), right: false };
    if (name === 'PrintDate') return { text: today, right: false };
    if (name === 'RecordNumber') return { text: String(rowNo ?? ''), right: false };
    if (name === 'Count' && !inDetail) return { text: '', right: false }; // 머리 구역의 «…Table.Count»는 숨은 건수 칸, 상세 줄의 Count는 매수(건수) 값
    const v = row?.[name];
    if (v == null || v === '') return { text: '', right: NUMERIC.test(name) };
    if (typeof v === 'number') return { text: v === 0 ? '' : won(v), right: true };
    return { text: String(v), right: false };
  };
  const draw = (o: Obj, key: string, y0: number, row?: RptRow, rowNo?: number, inDetail?: boolean) => {
    const top = y0 + o.t;
    if (o.k === 'l') {
      if (o.box) return <div key={key} style={{ position: 'absolute', left: tw(o.l), top: tw(top), width: tw(o.w), height: tw(o.h), border: '0.25mm solid #000' }} />;
      if (o.h === 0) return <div key={key} style={{ position: 'absolute', left: tw(o.l), top: tw(top), width: tw(o.w), borderTop: '0.25mm solid #000' }} />;
      if (o.w === 0) return <div key={key} style={{ position: 'absolute', left: tw(o.l), top: tw(top), height: tw(o.h), borderLeft: '0.25mm solid #000' }} />;
      return null;
    }
    let text = '', right = false;
    if (o.k === 't') { text = sub(o.x || '').replace(/\{@?[^}]*\}/g, m => m); }
    else { const v = val(o, row, rowNo, inDetail); text = v.text; right = v.right; }
    if (o.k === 't' && /^\s*$/.test(text)) return null;
    const align = o.k === 't' ? (o.a === 2 ? 'center' : o.a === 3 ? 'right' : 'left') : right ? 'right' : 'left';
    // 원본 글꼴(굴림체, 한글 1em·영숫자 0.5em 고정폭)보다 대체 글꼴이 넓어 칸을 넘으면 가로로 줄여 맞춘다.
    const need = [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 1 : 0.5), 0) * (o.s || 9) * 20;
    const k = need > o.w && o.w > 0 ? Math.max(0.55, o.w / need) : 1;
    return (
      <div key={key} style={{ position: 'absolute', left: tw(o.l), top: tw(top), width: tw(o.w), height: tw(o.h), lineHeight: tw(o.h), fontSize: `${o.s || 9}pt`, fontWeight: o.b ? 700 : 400, textAlign: align, whiteSpace: 'nowrap', overflow: 'visible' }}>
        <span style={{ display: 'inline-block', transform: `scaleX(${k})`, transformOrigin: align === 'right' ? 'right center' : align === 'center' ? 'center center' : 'left center', width: k < 1 ? `${100 / k}%` : undefined, textAlign: align }}>{text}</span>
      </div>
    );
  };
  let y = 0;
  const parts: React.ReactNode[] = [];
  if (rfOnly) {
    // 합계표처럼 «보고서 끝» 구역이 한 쪽을 차지하는 양식: 줄 쪽들 뒤에 그 구역만 따로 한 쪽으로 찍는다.
    rf?.o.forEach((o, j) => parts.push(draw(o, `rf${j}`, 0)));
    return (
      <div style={{ position: 'relative', width: tw(w), height: tw(h), margin: '0 auto 8px', background: '#fff', border: '1px solid #cbd5e1', pageBreakAfter: 'always', fontFamily: '"GulimChe","Gulim","Malgun Gothic","Apple SD Gothic Neo",sans-serif', color: '#000' }}>{parts}</div>
    );
  }
  heads.forEach((s, i) => { s.o.forEach((o, j) => parts.push(draw(o, `h${i}-${j}`, y))); y += s.h; });
  const bodyTop = y;
  rows.forEach((r, i) => { det?.o.forEach((o, j) => parts.push(draw(o, `d${i}-${j}`, bodyTop + i * (det?.h || 0), r, firstRowNo + i, true))); });
  if (isLast && rf && !(rf.h > 1500)) rf.o.forEach((o, j) => parts.push(draw(o, `rf${j}`, bodyTop + rows.length * (det?.h || 0))));
  if (pf) pf.o.forEach((o, j) => parts.push(draw(o, `pf${j}`, h - BOTTOM_MARGIN - pf.h)));
  return (
    <div style={{ position: 'relative', width: tw(w), height: tw(h), margin: '0 auto 8px', background: '#fff', border: '1px solid #cbd5e1', pageBreakAfter: 'always', fontFamily: '"GulimChe","Gulim","Malgun Gothic","Apple SD Gothic Neo",sans-serif', color: '#000' }}>{parts}</div>
  );
}

export function RptReportPages({ layoutKey, rows, params }: { layoutKey: string; rows: RptRow[]; params: Record<string, string> }) {
  const lay = LAYOUTS[layoutKey];
  if (!lay) return <p className="text-sm text-red-600">«{layoutKey}» 양식 좌표가 없습니다.</p>;
  const w = lay.landscape ? 16838 : 11906, h = lay.landscape ? 11906 : 16838;
  const hs = (r: Sec['role']) => lay.sections.filter(s => s.role === r).reduce((a, s) => a + s.h, 0);
  const rowH = lay.sections.find(s => s.role === 'detail')?.h || 300;
  const bigRf = hs('rf') > 1500;
  const cap = Math.max(1, Math.floor((h - BOTTOM_MARGIN - hs('pf') - hs('ph') - hs('ch') - (bigRf ? 0 : hs('rf'))) / rowH));
  const rowPages = Math.max(1, Math.ceil(rows.length / cap));
  const pages = rowPages + (bigRf ? 1 : 0);
  return (
    <div>
      {Array.from({ length: pages }, (_, p) => (
        <Page key={p} lay={lay} pageNo={p + 1} pages={pages} rows={p < rowPages ? rows.slice(p * cap, (p + 1) * cap) : []} firstRowNo={p * cap + 1} params={params} isLast={p === rowPages - 1} w={w} h={h} rfOnly={bigRf && p === rowPages} />
      ))}
    </div>
  );
}

export function RptPrintModal({ layoutKey, title, rows, params, onClose, total }: { layoutKey: string; title: string; rows: RptRow[]; params: Record<string, string>; onClose: () => void; total?: number }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl my-auto flex flex-col max-h-[95vh] print:m-0 print:p-0 print:w-full print:max-w-none print:shadow-none print:block print:h-auto print:max-h-none print:static">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-lg print:hidden">
          <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2"><Printer className="w-4 h-4 text-blue-600" /> 원본 양식 인쇄 미리보기 — {title} ({rows.length.toLocaleString('ko-KR')}줄{total && total > rows.length ? ` · 화면 성능을 위해 앞 ${rows.length.toLocaleString('ko-KR')}줄만 — 전체 ${total.toLocaleString('ko-KR')}줄은 조건을 좁히세요` : ''})</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5"><Printer className="w-3.5 h-3.5" /> 인쇄 (Ctrl+P)</button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="p-4 overflow-auto flex-1 bg-neutral-100/60 print:bg-white print:p-0 print:overflow-visible">
          <RptReportPages layoutKey={layoutKey} rows={rows} params={params} />
        </div>
      </div>
    </div>
  );
}
