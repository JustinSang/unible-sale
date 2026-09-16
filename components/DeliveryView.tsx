'use client';

import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  Truck,
  CheckCircle,
  Clock,
  MapPin,
  Phone,
  User,
  Search,
  Filter,
  PackageCheck,
  HardHat,
  ClipboardList,
  X
} from 'lucide-react';
import type { DeliveryOrder, OSTheme } from '@/types';

interface DeliveryViewProps {
  deliveries: DeliveryOrder[];
  onUpdateDelivery: (id: string, updates: Partial<DeliveryOrder>) => Promise<void>;
  osTheme: OSTheme;
}

export function DeliveryView({ deliveries, onUpdateDelivery, osTheme }: DeliveryViewProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const filtered = useMemo(() => {
    return deliveries.filter(d => {
      const matchStatus = filterStatus === 'all' || d.status === filterStatus;
      if (!matchStatus) return false;
      if (!deferredSearchTerm.trim()) return true;
      const q = deferredSearchTerm.toLowerCase();
      return (
        d.customerName.toLowerCase().includes(q) ||
        d.slipNo.toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q) ||
        (d.driverName && d.driverName.toLowerCase().includes(q))
      );
    });
  }, [deliveries, filterStatus, deferredSearchTerm]);

  // KPI Calculations
  const kpiData = useMemo(() => {
    let pendingCount = 0;
    let deliveringCount = 0;
    let deliveredCount = 0;

    deliveries.forEach(d => {
      if (d.status === 'pending' || d.status === 'dispatched') pendingCount++;
      if (d.status === 'delivering') deliveringCount++;
      if (d.status === 'delivered') deliveredCount++;
    });
    return { pendingCount, deliveringCount, deliveredCount };
  }, [deliveries]);

  const handleStatusChange = async (id: string, newStatus: DeliveryOrder['status']) => {
    await onUpdateDelivery(id, {
      status: newStatus,
      deliveredDate: newStatus === 'delivered' ? new Date().toISOString().slice(0, 10) : undefined
    });
  };

  const handleDriverChange = async (id: string, driverName: string) => {
    await onUpdateDelivery(id, { driverName });
  };

  return (
    <div className="space-y-4">
      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-amber-600 text-[11px] font-bold mb-1 flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> 배차/접수 대기</div>
              <div className="text-2xl font-black text-amber-700 font-mono">{kpiData.pendingCount}<span className="text-sm font-semibold text-amber-500 ml-1">건</span></div>
              <div className="text-[10px] text-amber-500 mt-0.5">배차 예정 화물</div>
            </div>
            <Clock className="w-9 h-9 text-amber-300" />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-blue-600 text-[11px] font-bold mb-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> 운송 진행 중</div>
              <div className="text-2xl font-black text-blue-900 font-mono">{kpiData.deliveringCount}<span className="text-sm font-semibold text-blue-500 ml-1">대</span></div>
              <div className="text-[10px] text-blue-500 mt-0.5">현재 이동 중인 배송 차량</div>
            </div>
            <Truck className="w-9 h-9 text-blue-300" />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-600 text-[11px] font-bold mb-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> 배송 완료</div>
              <div className="text-2xl font-black text-emerald-700 font-mono">{kpiData.deliveredCount}<span className="text-sm font-semibold text-emerald-500 ml-1">건</span></div>
              <div className="text-[10px] text-emerald-500 mt-0.5">누적 배송 완료 내역</div>
            </div>
            <PackageCheck className="w-9 h-9 text-emerald-300" />
          </div>
        </div>
      </div>

      {/* Top Header */}
      <div className={`p-4 rounded-xl border shadow-sm ${
        osTheme === 'winxp-retro'
          ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>출고 및 현장 배송 관리 ({deliveries.length}건)</span>
            </h2>
            <p className="text-xs text-slate-500">
              전표 발행과 연계된 건설 현장/공장 직납 화물 배차 및 실시간 배송 추적
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="전표/거래처/주소 검색..."
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

        {/* Status Filter tabs */}
        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-600">진행 상태:</span>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filterStatus === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체 ({deliveries.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filterStatus === 'pending' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            접수/배차대기 ({deliveries.filter(d => d.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilterStatus('delivering')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filterStatus === 'delivering' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            배송/운송중 ({deliveries.filter(d => d.status === 'delivering').length})
          </button>
          <button
            onClick={() => setFilterStatus('delivered')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filterStatus === 'delivered' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            배송완료 ({deliveries.filter(d => d.status === 'delivered').length})
          </button>
        </div>
      </div>

      {/* Deliveries Table */}
      <div className={`rounded-xl border shadow-sm overflow-hidden ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto" role="region" aria-label="출고 및 배송 내역">
          <table className="w-full text-left text-xs border-collapse font-sans" role="grid">
            <thead role="rowgroup">
              <tr className="bg-slate-50/90 backdrop-blur-sm text-slate-500 font-semibold border-b border-slate-200 select-none whitespace-nowrap sticky top-0 z-10">
                <th className="py-3 px-3 min-w-[100px]">요청일자</th>
                <th className="py-3 px-3 min-w-[140px]">전표번호</th>
                <th className="py-3 px-3 min-w-[180px]">고객사 / 현장명</th>
                <th className="py-3 px-3 min-w-[200px]">배송지 주소</th>
                <th className="py-3 px-3 min-w-[160px]">품목 내역 요약</th>
                <th className="py-3 px-3 min-w-[120px]">담당 기사</th>
                <th className="py-3 px-3 min-w-[90px] text-center">배송 상태</th>
                <th className="py-3 px-3 min-w-[120px] text-center">상태 변경</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white" role="rowgroup">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    해당 조건의 배송 오더가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map(d => (
                  <tr key={d.id} role="row" className="hover:bg-blue-50/40 transition-colors whitespace-nowrap">
                    <td className="py-2.5 px-3 font-mono text-slate-600">{d.requestedDate}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{d.slipNo}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{d.customerName}</span>
                        {d.siteName && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm">
                            <HardHat className="w-3 h-3 text-indigo-600" />
                            <span>{d.siteName}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{d.tel}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[220px] truncate" title={d.address}>
                      {d.address}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate" title={d.itemsSummary}>
                      {d.itemsSummary}
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={d.driverName || ''}
                        onChange={e => handleDriverChange(d.id, e.target.value)}
                        placeholder="기사명/연락처"
                        className="px-2 py-1 border border-slate-300 rounded text-xs w-28 bg-white focus:ring-1 focus:ring-blue-500 transition-colors"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        d.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : d.status === 'delivering'
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : 'bg-amber-100 text-amber-800 border-amber-200'
                      }`}>
                        {d.status === 'pending'
                          ? '배차대기'
                          : d.status === 'dispatched'
                          ? '배차완료'
                          : d.status === 'delivering'
                          ? '배송중'
                          : '배송완료'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <select
                        value={d.status}
                        onChange={e => handleStatusChange(d.id, e.target.value as any)}
                        className={`px-2 py-1.5 border rounded-md text-xs font-semibold transition-colors focus:ring-1 focus:ring-blue-500 ${
                          d.status === 'delivered' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
                          d.status === 'delivering' ? 'bg-blue-50 border-blue-300 text-blue-800' :
                          'bg-white border-slate-300 text-slate-700'
                        }`}
                      >
                        <option value="pending">배차대기</option>
                        <option value="delivering">🚀 배송출발</option>
                        <option value="delivered">✅ 배송완료</option>
                        <option value="cancelled">취소</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
