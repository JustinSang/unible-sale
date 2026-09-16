'use client';

import React, { useState, useMemo } from 'react';
import {
  Database,
  Sliders,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  RotateCcw,
  Check,
  X
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

  // Modal for manual stock adjustment
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [targetProductId, setTargetProductId] = useState<string>(products[0]?.id || '');
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('월말 정기 재고 실사 차이분 조정');

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchProduct = selectedProductId === 'all' || log.productId === selectedProductId;
      if (!matchProduct) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        log.productName.toLowerCase().includes(q) ||
        log.spec.toLowerCase().includes(q) ||
        (log.slipNo && log.slipNo.toLowerCase().includes(q)) ||
        log.reason.toLowerCase().includes(q)
      );
    });
  }, [logs, selectedProductId, searchTerm]);

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
      {/* Top Controls */}
      <div className={`p-4 rounded-lg border shadow-xs ${
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
              className="px-3 py-1.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-xs"
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
              className="px-2.5 py-1 border border-slate-300 rounded bg-white text-xs max-w-xs"
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
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded bg-white text-xs w-56"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className={`p-4 rounded-lg border shadow-xs overflow-hidden ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-semibold select-none">
                <th className="py-2.5 px-3">일자</th>
                <th className="py-2.5 px-3">품목명</th>
                <th className="py-2.5 px-3">규격 (Spec)</th>
                <th className="py-2.5 px-3 text-center">변동 구분</th>
                <th className="py-2.5 px-3 text-right">변동 수량</th>
                <th className="py-2.5 px-3 text-right">변경 전</th>
                <th className="py-2.5 px-3 text-right font-bold text-slate-800">변경 후</th>
                <th className="py-2.5 px-3">연계 전표</th>
                <th className="py-2.5 px-3">변동 사유 / 적요</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
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
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-mono text-slate-600">{log.date}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{log.productName}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{log.spec}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          log.changeType === 'in'
                            ? 'bg-emerald-100 text-emerald-800'
                            : log.changeType === 'out'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-indigo-100 text-indigo-800'
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
                      <td className={`py-2 px-3 text-right font-mono font-bold ${
                        isOut ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {isOut ? `-${log.changeQty}` : `+${log.changeQty}`}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">
                        {log.beforeQty}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {log.afterQty}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {log.slipNo || '-'}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{log.reason}</td>
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
                <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-500">현재 전산 재고:</span>
                    <strong className="font-mono text-slate-800">
                      {targetProduct.currentStock} {targetProduct.unit}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">조정 후 예상 재고:</span>
                    <strong className="font-mono text-blue-700 font-bold">
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
                  className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
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
