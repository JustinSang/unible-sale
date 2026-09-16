'use client';

import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  Database,
  Sliders,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity
} from 'lucide-react';
import type { InventoryLog, Product, OSTheme } from '@/types';

interface InventoryLedgerViewProps {
  logs: InventoryLog[];
  products: Product[];
  onStockAdjust: (productId: string, adjustQty: number, reason: string) => Promise<void>;
  osTheme: OSTheme;
}

export function InventoryLedgerView({
  logs,
  products,
  onStockAdjust,
  osTheme
}: InventoryLedgerViewProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Modal for manual stock adjustment
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [targetProductId, setTargetProductId] = useState<string>(products[0]?.id || '');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('월말 정기 재고 실사 차이분 조정');

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchProduct = selectedProductId === 'all' || log.productId === selectedProductId;
      if (!matchProduct) return false;
      if (!deferredSearchTerm.trim()) return true;
      const q = deferredSearchTerm.toLowerCase();
      return (
        log.productName.toLowerCase().includes(q) ||
        log.spec.toLowerCase().includes(q) ||
        (log.slipNo && log.slipNo.toLowerCase().includes(q)) ||
        log.reason.toLowerCase().includes(q)
      );
    });
  }, [logs, selectedProductId, deferredSearchTerm]);

  // KPI Calculations
  const kpiData = useMemo(() => {
    let todayIn = 0;
    let todayOut = 0;
    let todayAdjust = 0;
    const todayStr = new Date().toISOString().slice(0, 10);

    logs.forEach(log => {
      if (log.date === todayStr) {
        if (log.changeType === 'in' || log.changeType === 'return') todayIn++;
        else if (log.changeType === 'out') todayOut++;
        else if (log.changeType === 'adjust_plus' || log.changeType === 'adjust_minus') todayAdjust++;
      }
    });

    return { todayIn, todayOut, todayAdjust };
  }, [logs]);

  const targetProduct = products.find(p => p.id === targetProductId);

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetProductId || adjustQty === 0) {
      alert('조정할 품목과 0이 아닌 수량을 입력해주세요.');
      return;
    }

    await onStockAdjust(targetProductId, adjustQty, adjustReason);
    setIsAdjustModalOpen(false);
    setAdjustQty(0);
  };

  return (
    <div className="space-y-4">
      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-600 text-[11px] font-bold mb-1 flex items-center gap-1"><ArrowDownToLine className="w-3.5 h-3.5" /> 오늘 입고 건수</div>
              <div className="text-2xl font-black text-emerald-700 font-mono">{kpiData.todayIn}<span className="text-sm font-semibold text-emerald-500 ml-1">건</span></div>
              <div className="text-[10px] text-emerald-500 mt-0.5">매입 및 반품 입고 합계</div>
            </div>
            <ArrowDownToLine className="w-9 h-9 text-emerald-300" />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-rose-50 to-rose-100/50 border border-rose-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-rose-600 text-[11px] font-bold mb-1 flex items-center gap-1"><ArrowUpFromLine className="w-3.5 h-3.5" /> 오늘 출고 건수</div>
              <div className="text-2xl font-black text-rose-700 font-mono">{kpiData.todayOut}<span className="text-sm font-semibold text-rose-500 ml-1">건</span></div>
              <div className="text-[10px] text-rose-500 mt-0.5">매출 출고 합계</div>
            </div>
            <ArrowUpFromLine className="w-9 h-9 text-rose-300" />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-indigo-600 text-[11px] font-bold mb-1 flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> 오늘 실사 조정</div>
              <div className="text-2xl font-black text-indigo-700 font-mono">{kpiData.todayAdjust}<span className="text-sm font-semibold text-indigo-500 ml-1">건</span></div>
              <div className="text-[10px] text-indigo-500 mt-0.5">창고 실사 조정 건수</div>
            </div>
            <Sliders className="w-9 h-9 text-indigo-300" />
          </div>
        </div>
      </div>

      {/* Top Controls */}
      <div className={`p-4 rounded-xl border shadow-sm ${
        osTheme === 'winxp-retro'
          ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-600" />
              <span>재고 수불부 / 실시간 수불 대장 ({logs.length}건 기록)</span>
            </h2>
            <p className="text-xs text-slate-500">
              매출 출고, 매입 입고, 반품 및 실사 조정에 따른 입출고 이력 및 재고 변동 내역
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setTargetProductId(products[0]?.id || '');
                setIsAdjustModalOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Sliders className="w-4 h-4" /> 재고 실사 / 수기 조정
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">품목별 필터:</span>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs max-w-xs focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">전체 품목 수불 보기</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.spec}) - 현재고: {p.currentStock}{p.unit}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="품목명/전표번호/사유 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-8 py-1.5 border border-slate-300 rounded-lg bg-white text-xs w-64 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="w-3.5 h-3.5" /></button>
            )}
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className={`rounded-xl border shadow-sm overflow-hidden ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto" role="region" aria-label="재고 수불부 내역">
          <table className="w-full text-left text-xs border-collapse font-sans" role="grid">
            <thead role="rowgroup">
              <tr className="bg-slate-50/90 backdrop-blur-sm text-slate-500 font-semibold border-b border-slate-200 select-none whitespace-nowrap sticky top-0 z-10">
                <th className="py-3 px-3 min-w-[100px]">일자</th>
                <th className="py-3 px-3 min-w-[160px]">품목명</th>
                <th className="py-3 px-3 min-w-[120px]">규격 (Spec)</th>
                <th className="py-3 px-3 min-w-[90px] text-center">변동 구분</th>
                <th className="py-3 px-3 min-w-[90px] text-right">변동 수량</th>
                <th className="py-3 px-3 min-w-[90px] text-right">변경 전</th>
                <th className="py-3 px-3 min-w-[90px] text-right font-bold text-slate-800">변경 후</th>
                <th className="py-3 px-3 min-w-[140px]">연계 전표</th>
                <th className="py-3 px-3 min-w-[160px]">변동 사유 / 적요</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white" role="rowgroup">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    재고 수불 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isOut = log.changeType === 'out' || log.changeType === 'adjust_minus';

                  return (
                    <tr key={log.id} role="row" className="hover:bg-blue-50/40 transition-colors whitespace-nowrap">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{log.date}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{log.productName}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{log.spec}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          log.changeType === 'in'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : log.changeType === 'out'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {log.changeType === 'in'
                            ? '입고 (+)'
                            : log.changeType === 'out'
                            ? '출고 (-)'
                            : log.changeType === 'return'
                            ? '반품 (+)'
                            : '실사조정'}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold text-sm ${
                        isOut ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {isOut ? `-${log.changeQty}` : `+${log.changeQty}`}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {log.beforeQty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 text-sm bg-slate-50/50">
                        {log.afterQty}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {log.slipNo || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-[200px]" title={log.reason}>{log.reason}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-300 shadow-xl max-w-md w-full p-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>재고 수기 실사 조정</span>
              </h3>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="pt-3 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">조정 대상 품목</label>
                <select
                  value={targetProductId}
                  onChange={e => setTargetProductId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-medium bg-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} [{p.spec}] (전산재고: {p.currentStock}{p.unit})
                    </option>
                  ))}
                </select>
              </div>

              {targetProduct && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm shadow-inner">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-500 font-semibold">현재 전산 재고:</span>
                    <strong className="font-mono text-slate-800 text-lg">
                      {targetProduct.currentStock} {targetProduct.unit}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-bold">조정 후 예상 재고:</span>
                    <strong className="font-mono text-indigo-700 font-black text-xl">
                      {targetProduct.currentStock + adjustQty} {targetProduct.unit}
                    </strong>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  증감 수량 (+증가, -감소)
                </label>
                <input
                  type="number"
                  placeholder="예: 10 또는 -5"
                  value={adjustQty || ''}
                  onChange={e => setAdjustQty(Number(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold text-right"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  실제 창고 실사 수량과의 차이값을 입력하세요 (예: 5개 부족하면 -5)
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">조정 사유</label>
                <input
                  type="text"
                  placeholder="예: 정기 재고 실사 차이분 반영"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm"
                >
                  조정 반영
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
