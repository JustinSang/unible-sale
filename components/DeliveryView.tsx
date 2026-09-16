'use client';

import React, { useState, useMemo } from 'react';
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
  HardHat
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

  const filtered = useMemo(() => {
    return deliveries.filter(d => {
      const matchStatus = filterStatus === 'all' || d.status === filterStatus;
      if (!matchStatus) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        d.customerName.toLowerCase().includes(q) ||
        d.slipNo.toLowerCase().includes(q) ||
        d.address.toLowerCase().includes(q) ||
        (d.driverName && d.driverName.toLowerCase().includes(q))
      );
    });
  }, [deliveries, filterStatus, searchTerm]);

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
      {/* Top Header */}
      <div className={`p-4 rounded-lg border shadow-xs ${
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
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded bg-white text-xs w-56"
              />
            </div>
          </div>
        </div>

        {/* Status Filter tabs */}
        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-slate-600">진행 상태:</span>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              filterStatus === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            전체 ({deliveries.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              filterStatus === 'pending' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            접수/배차대기 ({deliveries.filter(d => d.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilterStatus('delivering')}
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              filterStatus === 'delivering' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            배송/운송중 ({deliveries.filter(d => d.status === 'delivering').length})
          </button>
          <button
            onClick={() => setFilterStatus('delivered')}
            className={`px-2.5 py-1 rounded text-xs font-semibold ${
              filterStatus === 'delivered' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            배송완료 ({deliveries.filter(d => d.status === 'delivered').length})
          </button>
        </div>
      </div>

      {/* Deliveries Table */}
      <div className={`p-4 rounded-lg border shadow-xs overflow-hidden ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 font-semibold select-none">
                <th className="py-2.5 px-3">요청일자</th>
                <th className="py-2.5 px-3">전표번호</th>
                <th className="py-2.5 px-3">고객사 / 현장명</th>
                <th className="py-2.5 px-3">배송지 주소</th>
                <th className="py-2.5 px-3">품목 내역 요약</th>
                <th className="py-2.5 px-3">담당 기사</th>
                <th className="py-2.5 px-3 text-center">배송 상태</th>
                <th className="py-2.5 px-3 text-center">상태 변경</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    해당 조건의 배송 오더가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 font-mono text-slate-600">{d.requestedDate}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{d.slipNo}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{d.customerName}</span>
                        {d.siteName && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                            <HardHat className="w-2.5 h-2.5 text-blue-600" />
                            <span>{d.siteName}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{d.tel}</div>
                    </td>
                    <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate" title={d.address}>
                      {d.address}
                    </td>
                    <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate" title={d.itemsSummary}>
                      {d.itemsSummary}
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={d.driverName || ''}
                        onChange={e => handleDriverChange(d.id, e.target.value)}
                        placeholder="기사명 입력"
                        className="px-1.5 py-0.5 border border-slate-200 rounded text-xs w-24 bg-white"
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        d.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : d.status === 'delivering'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
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
                    <td className="py-2 px-3 text-center">
                      <select
                        value={d.status}
                        onChange={e => handleStatusChange(d.id, e.target.value as any)}
                        className="px-2 py-1 border border-slate-300 rounded text-xs font-semibold bg-white"
                      >
                        <option value="pending">배차대기</option>
                        <option value="delivering">배송중</option>
                        <option value="delivered">배송완료</option>
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
