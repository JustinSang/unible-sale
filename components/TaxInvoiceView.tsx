'use client';

import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  FileCheck,
  Plus,
  Search,
  Printer,
  X,
  CheckCircle,
  Building,
  DollarSign,
  TrendingUp,
  FileDigit
} from 'lucide-react';
import type { Customer, TaxInvoice, SystemConfig, OSTheme } from '@/types';

interface TaxInvoiceViewProps {
  customers: Customer[];
  taxInvoices: TaxInvoice[];
  config: SystemConfig;
  onAddTaxInvoice: (tax: Partial<TaxInvoice>) => Promise<void>;
  osTheme: OSTheme;
}

export function TaxInvoiceView({
  customers,
  taxInvoices,
  config,
  onAddTaxInvoice,
  osTheme
}: TaxInvoiceViewProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<TaxInvoice | null>(null);

  // Form State
  const [form, setForm] = useState<Partial<TaxInvoice>>({
    taxNo: `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001`,
    taxDate: new Date().toISOString().slice(0, 10),
    customerName: customers[0]?.name || '',
    productSummary: '화스너 및 배관자재 일체',
    supplyAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    isIssued: true,
    memo: ''
  });

  const filteredInvoices = useMemo(() => {
    return taxInvoices.filter(tx => {
      if (!deferredSearchTerm.trim()) return true;
      const q = deferredSearchTerm.toLowerCase();
      return (
        tx.customerName.toLowerCase().includes(q) ||
        tx.taxNo.toLowerCase().includes(q) ||
        tx.productSummary.toLowerCase().includes(q)
      );
    });
  }, [taxInvoices, deferredSearchTerm]);

  // KPI Calculations
  const kpiData = useMemo(() => {
    const today = new Date().toISOString().slice(0, 7);
    let monthlyIssuedCount = 0;
    let monthlySupplyAmount = 0;
    let monthlyTaxAmount = 0;
    
    taxInvoices.forEach(tx => {
      if (tx.taxDate.startsWith(today)) {
        monthlyIssuedCount++;
        monthlySupplyAmount += tx.supplyAmount;
        monthlyTaxAmount += tx.taxAmount;
      }
    });
    return { monthlyIssuedCount, monthlySupplyAmount, monthlyTaxAmount };
  }, [taxInvoices]);

  const handleSupplyChange = (val: number) => {
    const supply = Number(val) || 0;
    const tax = Math.round(supply * 0.1);
    setForm({
      ...form,
      supplyAmount: supply,
      taxAmount: tax,
      totalAmount: supply + tax
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName || !form.supplyAmount) {
      alert('거래처와 공급가액을 입력해주세요.');
      return;
    }
    await onAddTaxInvoice(form);
    setIsModalOpen(false);
  };

  const formatKRW = (num: number) => num.toLocaleString('ko-KR') + '원';

  return (
    <div className="space-y-4">
      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-blue-600 text-[11px] font-bold mb-1 flex items-center gap-1"><FileDigit className="w-3.5 h-3.5" /> 당월 발행 건수</div>
              <div className="text-2xl font-black text-blue-900 font-mono">{kpiData.monthlyIssuedCount}<span className="text-sm font-semibold text-blue-500 ml-1">건</span></div>
              <div className="text-[10px] text-blue-500 mt-0.5">이번 달 총 발행</div>
            </div>
            <FileCheck className="w-9 h-9 text-blue-300" />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-600 text-[11px] font-bold mb-1 flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> 당월 공급가액</div>
              <div className="text-2xl font-black text-emerald-700 font-mono">{formatKRW(kpiData.monthlySupplyAmount)}</div>
              <div className="text-[10px] text-emerald-500 mt-0.5">이번 달 공급가 합계</div>
            </div>
            <TrendingUp className="w-9 h-9 text-emerald-300" />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-amber-600 text-[11px] font-bold mb-1 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> 당월 세액 합계</div>
              <div className="text-2xl font-black text-amber-700 font-mono">{formatKRW(kpiData.monthlyTaxAmount)}</div>
              <div className="text-[10px] text-amber-500 mt-0.5">이번 달 부가세(VAT) 합계</div>
            </div>
            <DollarSign className="w-9 h-9 text-amber-300" />
          </div>
        </div>
      </div>

      {/* Top Banner */}
      <div className={`p-4 rounded-xl border shadow-sm ${
        osTheme === 'winxp-retro'
          ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600" />
              <span>기간별 세금계산서 발행 및 합산 청구 관리 ({taxInvoices.length}건)</span>
            </h2>
            <p className="text-xs text-slate-500">
              월말 거래처별 전표 합산 청구서 및 국세청 전자세금계산서 표준 서식 발행
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="거래처/세금계산서번호 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 pr-8 py-1.5 border border-slate-300 rounded-lg bg-white text-xs w-64 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="w-3.5 h-3.5" /></button>
              )}
            </div>

            <button
              onClick={() => {
                setForm({
                  taxNo: `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(taxInvoices.length + 1).padStart(3, '0')}`,
                  taxDate: new Date().toISOString().slice(0, 10),
                  customerName: customers[0]?.name || '',
                  productSummary: '화스너 및 배관자재 일체',
                  supplyAmount: 0,
                  taxAmount: 0,
                  totalAmount: 0,
                  isIssued: true,
                  memo: ''
                });
                setIsModalOpen(true);
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> 세금계산서 발행
            </button>
          </div>
        </div>
      </div>

      {/* Tax Invoices Table */}
      <div className={`rounded-xl border shadow-sm overflow-hidden ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto" role="region" aria-label="세금계산서 목록">
          <table className="w-full text-left text-xs border-collapse font-sans" role="grid">
            <thead role="rowgroup">
              <tr className="bg-slate-50/90 backdrop-blur-sm text-slate-500 font-semibold border-b border-slate-200 select-none whitespace-nowrap sticky top-0 z-10">
                <th className="py-3 px-3 min-w-[100px]">작성일자</th>
                <th className="py-3 px-3 min-w-[160px]">계산서 승인번호</th>
                <th className="py-3 px-3 min-w-[150px]">공급받는자 (거래처)</th>
                <th className="py-3 px-3 min-w-[180px]">품목 요약</th>
                <th className="py-3 px-3 min-w-[110px] text-right">공급가액</th>
                <th className="py-3 px-3 min-w-[100px] text-right">세액 (10%)</th>
                <th className="py-3 px-3 min-w-[110px] text-right">합계금액</th>
                <th className="py-3 px-3 min-w-[90px] text-center">발행상태</th>
                <th className="py-3 px-3 min-w-[110px] text-center">인쇄 미리보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white" role="rowgroup">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    발행된 세금계산서 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map(tx => (
                  <tr key={tx.id} role="row" className="hover:bg-blue-50/40 transition-colors whitespace-nowrap">
                    <td className="py-2.5 px-3 font-mono text-slate-600">{tx.taxDate}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{tx.taxNo}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{tx.customerName}</td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-[200px]" title={tx.productSummary}>{tx.productSummary}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                      {formatKRW(tx.supplyAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-500">
                      {formatKRW(tx.taxAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                      {formatKRW(tx.totalAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {tx.isIssued ? '발행완료' : '작성중'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => setSelectedInvoice(tx)}
                        className="px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-blue-700 border border-slate-300 inline-flex items-center gap-1 shadow-sm transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" /> 미리보기
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Preview Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6 text-xs text-slate-900">
            <div className="flex justify-between items-center pb-3 border-b mb-4">
              <h3 className="font-bold text-sm text-red-700">
                전자세금계산서 (공급자 보관용 / 공급받는자용)
              </h3>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="border-2 border-red-600 p-4 rounded text-xs space-y-4 font-sans">
              <div className="text-center font-black text-xl text-red-700 tracking-widest border-b-2 border-red-600 pb-2">
                세 금 계 산 서
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-red-400 p-2">
                  <div className="bg-red-50 text-red-800 font-bold px-1 py-0.5 mb-1">공급자</div>
                  <div>등록번호: <strong>{config.companyInfo.bizNumber}</strong></div>
                  <div>상호: {config.companyInfo.name} 대표: {config.companyInfo.ceo}</div>
                  <div>사업장: {config.companyInfo.address}</div>
                  <div>업태/종목: {config.companyInfo.bizType} / {config.companyInfo.bizItem}</div>
                </div>
                <div className="border border-blue-400 p-2">
                  <div className="bg-blue-50 text-blue-800 font-bold px-1 py-0.5 mb-1">공급받는자</div>
                  <div>상호: <strong>{selectedInvoice.customerName}</strong></div>
                  <div>작성일자: {selectedInvoice.taxDate}</div>
                  <div>승인번호: {selectedInvoice.taxNo}</div>
                </div>
              </div>

              <div className="border border-slate-300 p-2 bg-slate-50 flex justify-between font-bold text-sm">
                <span>합계금액:</span>
                <span className="font-mono text-blue-800">{formatKRW(selectedInvoice.totalAmount)}</span>
              </div>

              <table className="w-full border-collapse border border-slate-300 text-center">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border p-1.5">품목 및 규격</th>
                    <th className="border p-1.5 text-right">공급가액</th>
                    <th className="border p-1.5 text-right">세액</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">{selectedInvoice.productSummary}</td>
                    <td className="border p-2 text-right font-mono">{formatKRW(selectedInvoice.supplyAmount)}</td>
                    <td className="border p-2 text-right font-mono">{formatKRW(selectedInvoice.taxAmount)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="text-center text-[11px] text-slate-500 pt-2">
                위 금액을 정히 영수(청구) 함.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-3 py-1.5 border rounded bg-white hover:bg-slate-50"
              >
                닫기
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" /> 인쇄하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tax Invoice Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border shadow-xl max-w-md w-full p-4 text-xs">
            <div className="flex justify-between items-center pb-3 border-b mb-3">
              <h3 className="font-bold text-sm text-slate-800">세금계산서 신규 발행</h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">거래처 선택</label>
                <select
                  value={form.customerName}
                  onChange={e => setForm({ ...form, customerName: e.target.value })}
                  className="w-full px-2.5 py-1.5 border rounded bg-white"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.bizNumber || '사업자미등록'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">품목 요약</label>
                <input
                  type="text"
                  value={form.productSummary || ''}
                  onChange={e => setForm({ ...form, productSummary: e.target.value })}
                  className="w-full px-2.5 py-1.5 border rounded bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">공급가액 (원)</label>
                <input
                  type="number"
                  placeholder="공급가액 입력"
                  value={form.supplyAmount || ''}
                  onChange={e => handleSupplyChange(Number(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 border rounded bg-white text-right font-mono font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded">
                <div>
                  <span className="text-slate-500">세액(10%):</span>{' '}
                  <strong className="font-mono">{formatKRW(form.taxAmount || 0)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">총 청구금액:</span>{' '}
                  <strong className="font-mono text-blue-700">{formatKRW(form.totalAmount || 0)}</strong>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded border"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  발행 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
