'use client';

// 전표입력 보조 두 가지: «거래내역 보기»(이 거래처의 지난 전표 줄에서 골라 담기)와 «My품목»(자주 쓰는 품목 모음).
// 이카운트 판매입력의 «거래내역보기»·«My품목»을 같은 흐름으로 만든 것이다(근거: docs/analysis_rea/ecount/ecount_판매입력_REA분석_2026-10-17.md).
// 지름길: My품목은 이 브라우저(localStorage)에만 저장한다 — 여러 PC 공유가 필요하면 서버 저장으로 바꿀 것.
import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { Slip, SlipItem, SlipType } from '@/types';

const TYPE_LABEL: Record<string, string> = {
  SALES: '매출', PURCHASE: '매입', RETURN_IN: '반입', RETURN_OUT: '반출', ESTIMATE: '견적', ORDER: '발주', DELIVERY: '납품', CONTRACT: '수주',
};
const won = (n: number) => (n || 0).toLocaleString('ko-KR');

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-slate-50 rounded-t-lg">
          <b className="text-sm">{title}</b>
          <button type="button" onClick={onClose} aria-label="닫기"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 overflow-y-auto text-xs">{children}</div>
      </div>
    </div>
  );
}

/** 이 거래처의 지난 전표 줄 목록. 줄을 골라 «현재 전표에 담기». */
export function HistoryPicker({ slips, customerId, customerName, onAdd, onClose }: {
  slips: Slip[]; customerId: string; customerName: string; onAdd: (items: SlipItem[]) => void; onClose: () => void;
}) {
  const [kw, setKw] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const rows = useMemo(() => {
    const out: { key: string; slip: Slip; item: SlipItem }[] = [];
    [...slips].filter(s => s.customerId === customerId).sort((a, b) => (b.slipDate || '').localeCompare(a.slipDate || ''))
      .forEach(s => (s.items || []).forEach((it, i) => { if (it.productName) out.push({ key: `${s.id}#${i}`, slip: s, item: it }); }));
    const q = kw.trim().replace(/\s/g, '').toLowerCase();
    const f = q ? out.filter(r => `${r.item.productName}${r.item.spec}`.replace(/\s/g, '').toLowerCase().includes(q)) : out;
    return f.slice(0, 300);
  }, [slips, customerId, kw]);
  const toggle = (k: string) => setPicked(p => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const add = () => { onAdd(rows.filter(r => picked.has(r.key)).map(r => r.item)); onClose(); };
  return (
    <Modal title={`거래내역 보기 — ${customerName || '거래처 미선택'}`} onClose={onClose}>
      {!customerId ? <p className="text-slate-500 py-6 text-center">먼저 거래처를 선택하세요.</p> : (
        <>
          <div className="flex gap-2 mb-2">
            <input autoFocus value={kw} onChange={e => setKw(e.target.value)} placeholder="품명·규격 검색" className="flex-1 border rounded px-2 py-1" />
            <button type="button" disabled={picked.size === 0} onClick={add}
              className="px-3 py-1 rounded bg-blue-600 text-white font-semibold disabled:opacity-40">선택 {picked.size}줄 담기</button>
          </div>
          {rows.length === 0 ? <p className="text-slate-500 py-6 text-center">이 거래처의 지난 거래 줄이 없습니다.</p> : (
            <table className="w-full border-collapse">
              <thead><tr className="bg-slate-50 text-slate-500 border-b">
                <th className="p-1 w-6" /><th className="p-1 text-left">일자</th><th className="p-1">구분</th><th className="p-1 text-left">품명</th>
                <th className="p-1 text-left">규격</th><th className="p-1 text-right">수량</th><th className="p-1 text-right">단가</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.key} className={`border-b border-slate-100 cursor-pointer hover:bg-blue-50 ${picked.has(r.key) ? 'bg-blue-50' : ''}`} onClick={() => toggle(r.key)}>
                    <td className="p-1"><input type="checkbox" checked={picked.has(r.key)} onChange={() => toggle(r.key)} onClick={e => e.stopPropagation()} /></td>
                    <td className="p-1 whitespace-nowrap">{r.slip.slipDate}</td>
                    <td className="p-1 text-center">{TYPE_LABEL[r.slip.slipType as SlipType] || r.slip.slipType}</td>
                    <td className="p-1">{r.item.productName}</td>
                    <td className="p-1">{r.item.spec}</td>
                    <td className="p-1 text-right">{won(r.item.qty)}</td>
                    <td className="p-1 text-right">{won(r.item.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-slate-400 mt-2">최근 거래 순으로 최대 300줄. 담은 줄은 수량·단가를 그대로 가져오니 전표에서 고치세요.</p>
        </>
      )}
    </Modal>
  );
}

interface MyItem { productId: string; productCode: string; productName: string; spec: string; unit: string; unitPrice: number }
const KEY = 'unible.myProducts';
const load = (): MyItem[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const save = (v: MyItem[]) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 저장 불가면 무시 */ } };
const same = (a: MyItem, b: MyItem) => (a.productId && a.productId === b.productId) || (a.productName === b.productName && a.spec === b.spec);

/** 자주 쓰는 품목 모음. 현재 줄을 담거나, 모음에서 골라 전표에 넣는다. */
export function MyItemsPicker({ currentItem, onAdd, onClose }: {
  currentItem?: SlipItem; onAdd: (items: SlipItem[]) => void; onClose: () => void;
}) {
  const [list, setList] = useState<MyItem[]>([]);
  useEffect(() => { setList(load()); }, []);
  const cur: MyItem | null = currentItem && currentItem.productName
    ? { productId: currentItem.productId, productCode: currentItem.productCode, productName: currentItem.productName, spec: currentItem.spec, unit: currentItem.unit, unitPrice: currentItem.unitPrice }
    : null;
  const has = !!cur && list.some(m => same(m, cur));
  const put = () => { if (!cur || has) return; const n = [...list, cur]; setList(n); save(n); };
  const del = (m: MyItem) => { const n = list.filter(x => x !== m); setList(n); save(n); };
  const use = (m: MyItem) => {
    onAdd([{ id: '', productId: m.productId, productCode: m.productCode, productName: m.productName, spec: m.spec, unit: m.unit, qty: 1, unitPrice: m.unitPrice, supplyAmount: 0, taxAmount: 0, totalAmount: 0, memo: '' }]);
    onClose();
  };
  return (
    <Modal title="My품목" onClose={onClose}>
      <div className="mb-2">
        <button type="button" disabled={!cur || has} onClick={put} className="px-3 py-1 rounded border border-amber-300 bg-amber-50 disabled:opacity-40">
          {cur ? (has ? '이미 My품목에 있음' : `★ 현재 줄 «${cur.productName}» 담기`) : '현재 줄에 품목이 없습니다'}
        </button>
      </div>
      {list.length === 0 ? <p className="text-slate-500 py-6 text-center">담아 둔 품목이 없습니다.</p> : list.map((m, i) => (
        <div key={i} className="flex items-center gap-2 border-b border-slate-100 py-1">
          <button type="button" onClick={() => use(m)} className="flex-1 text-left hover:bg-blue-50 px-1 py-1 rounded">
            <span className="font-semibold">{m.productName}</span> <span className="text-slate-500">{m.spec}</span>
            <span className="float-right text-slate-500">{m.unit} · {won(m.unitPrice)}원</span>
          </button>
          <button type="button" onClick={() => del(m)} className="text-slate-400 hover:text-red-500 px-1">삭제</button>
        </div>
      ))}
      <p className="text-[11px] text-slate-400 mt-2">이 컴퓨터의 브라우저에만 저장됩니다. 눌러서 전표에 1개씩 넣고, 수량·단가는 전표에서 고치세요.</p>
    </Modal>
  );
}
