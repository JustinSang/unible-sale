'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Customer, TaxInvoice, SystemConfig, OSTheme, Slip } from '@/types';
import { TaxPrintModal } from './TaxPrintModal';
import { FileDigit, AlertCircle, X } from 'lucide-react';

interface TaxInvoiceViewProps {
  customers: Customer[];
  taxInvoices: TaxInvoice[];
  slips?: Slip[];
  config: SystemConfig;
  onAddTaxInvoice: (tax: Partial<TaxInvoice>) => Promise<void>;
  onNavigateTab?: (tab: string) => void;
  osTheme: OSTheme;
}

// Aggregated row from slips
interface AggregatedTaxRow {
  id: string;
  customerId: string;
  customerName: string;
  siteId?: string;
  siteName: string;
  amount: number;     // 공급가액
  tax: number;        // 세액
  total: number;      // 합계
  items: string[];    // product names for summary
  productSummary: string;
  checkReceipt: '영수' | '청구';
  slipCount: number;  // Number of slips in this aggregation
}

export function TaxInvoiceView({
  customers,
  taxInvoices,
  slips = [],
  config,
  onAddTaxInvoice,
  onNavigateTab,
  osTheme
}: TaxInvoiceViewProps) {
  // OkSale "기간별 세금계산서" state
  const [vatType, setVatType] = useState('1'); // 1: 매출부가세, 2: 매입부가세
  const [sumMethod, setSumMethod] = useState<'customer' | 'site'>('customer');
  
  // Default to current month
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  
  const [searchCustomer, setSearchCustomer] = useState('');
  const [printSiteName, setPrintSiteName] = useState(true);

  const [aggregatedData, setAggregatedData] = useState<AggregatedTaxRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Print Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printInvoices, setPrintInvoices] = useState<any[]>([]);

  // 미수미지F4 Modal State
  const [showReceivablesModal, setShowReceivablesModal] = useState(false);
  const [receivablesData, setReceivablesData] = useState<{customerName: string; receivables: number; payables: number}[]>([]);

  // View mode: 'aggregate' (슬립 기반 집계) | 'history' (기존 세금계산서 이력)
  const [viewMode, setViewMode] = useState<'aggregate' | 'history'>('aggregate');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. [검색F2] Action: Aggregate slips
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleSearch = useCallback(() => {
    if (viewMode === 'history') {
      // History mode: filter existing taxInvoices by date/customer
      // (No aggregation needed, just display)
      return;
    }

    // Filter slips by date and type
    // FIX: Case-insensitive comparison for slipType (bug: 'sales' vs 'SALES')
    const targetSlips = slips.filter(s => {
      if (s.slipDate < startDate || s.slipDate > endDate) return false;
      
      const normalizedType = s.slipType.toUpperCase();
      if (vatType === '1' && normalizedType !== 'SALES') return false;
      if (vatType === '2' && normalizedType !== 'PURCHASE') return false;
      
      if (searchCustomer.trim()) {
        if (!s.customerName.includes(searchCustomer.trim())) return false;
      }
      return true;
    });

    // Group by Customer or Site
    const grouped = new Map<string, AggregatedTaxRow>();
    targetSlips.forEach(s => {
      const key = sumMethod === 'customer' 
        ? s.customerId 
        : `${s.customerId}-${s.siteId || 'NONE'}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          customerId: s.customerId,
          customerName: s.customerName,
          siteId: s.siteId,
          siteName: s.siteName || '',
          amount: 0,
          tax: 0,
          total: 0,
          items: [],
          productSummary: '',
          checkReceipt: '영수',
          slipCount: 0
        });
      }
      
      const g = grouped.get(key)!;
      g.amount += s.totalSupplyAmount;
      g.tax += s.totalTaxAmount;
      g.total += s.totalAmount;
      g.slipCount += 1;
      if (s.items && s.items.length > 0) {
        g.items.push(s.items[0].productName);
      }
    });

    const result = Array.from(grouped.values()).map(g => {
      const uniqueItems = [...new Set(g.items)];
      const summary = uniqueItems.length > 1 
        ? `${uniqueItems[0]} 외 ${uniqueItems.length - 1}건` 
        : (uniqueItems[0] || '화스너 일체');
      return { ...g, productSummary: summary };
    });

    // Sort by customerName
    result.sort((a, b) => a.customerName.localeCompare(b.customerName));
    
    setAggregatedData(result);
    setSelectedIds(new Set());
  }, [slips, startDate, endDate, vatType, sumMethod, searchCustomer, viewMode]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. Keyboard shortcuts
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        handleSearch();
      } else if (e.key === 'F11') {
        e.preventDefault();
        if (viewMode === 'aggregate') {
          setSelectedIds(new Set(aggregatedData.map(d => d.id)));
        } else {
          setSelectedIds(new Set(filteredHistoryData.map(d => d.id)));
        }
      } else if (e.key === 'F12') {
        e.preventDefault();
        setSelectedIds(new Set());
      } else if (e.key === 'F9') {
        e.preventDefault();
        handlePrintF9();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleReceivablesF4();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleEsc();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregatedData, startDate, endDate, vatType, sumMethod, searchCustomer, viewMode, selectedIds]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. Print F9 Action
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handlePrintF9 = () => {
    if (selectedIds.size === 0) {
      alert('출력할 대상을 먼저 체크해주세요.');
      return;
    }
    
    if (viewMode === 'aggregate') {
      // Map selected data to TaxInvoice format
      const invoicesToPrint = Array.from(selectedIds).map(id => {
        const d = aggregatedData.find(x => x.id === id);
        if (!d) return null;
        
        const cust = customers.find(c => c.id === d.customerId);
        
        return {
          taxNo: `TX-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${d.customerId.slice(-4)}`,
          taxDate: endDate,
          customerName: printSiteName && d.siteName ? `${d.customerName} (${d.siteName})` : d.customerName,
          productSummary: d.productSummary,
          supplyAmount: d.amount,
          taxAmount: d.tax,
          totalAmount: d.total,
          isIssued: true,
          checkReceipt: d.checkReceipt,
          memo: '',
          customer: cust
        };
      }).filter(Boolean);

      setPrintInvoices(invoicesToPrint);
      setIsPrintModalOpen(true);
    } else {
      // History mode: print selected existing tax invoices
      const invoicesToPrint = Array.from(selectedIds).map(id => {
        const ti = taxInvoices.find(x => x.id === id);
        if (!ti) return null;
        const cust = customers.find(c => c.id === ti.customerId || c.name === ti.customerName);
        return {
          ...ti,
          customer: cust
        };
      }).filter(Boolean);

      setPrintInvoices(invoicesToPrint);
      setIsPrintModalOpen(true);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. 미수미지F4 Action
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleReceivablesF4 = () => {
    // Collect unique customer IDs from current data
    const customerIds = viewMode === 'aggregate'
      ? [...new Set(aggregatedData.map(d => d.customerId))]
      : [...new Set(taxInvoices.filter(t => selectedIds.has(t.id)).map(t => t.customerId).filter(Boolean) as string[])];
    
    const data = customerIds.map(cid => {
      const cust = customers.find(c => c.id === cid);
      return {
        customerName: cust?.name || '미지정',
        receivables: cust?.receivables || 0,
        payables: cust?.payables || 0
      };
    }).filter(d => d.receivables > 0 || d.payables! > 0);

    // Sort by receivables descending
    data.sort((a, b) => b.receivables - a.receivables);

    setReceivablesData(data);
    setShowReceivablesModal(true);
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. 종료Esc Action
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleEsc = () => {
    if (showReceivablesModal) {
      setShowReceivablesModal(false);
      return;
    }
    if (onNavigateTab) {
      onNavigateTab('slips');
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. Toggle checkReceipt for individual rows
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const toggleCheckReceipt = (id: string) => {
    setAggregatedData(prev => prev.map(row => {
      if (row.id === id) {
        return { ...row, checkReceipt: row.checkReceipt === '영수' ? '청구' : '영수' };
      }
      return row;
    }));
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const formatKRW = (num: number) => num.toLocaleString('ko-KR');

  // 발행이력 필터 — totals가 쓰므로 그 앞에 둔다(뒤에 있으면 «발행이력» 탭에서 초기화 전 접근 오류로 화면이 멈춤)
  const filteredHistoryData = useMemo(() => {
    if (viewMode !== 'history') return [];
    return taxInvoices.filter(ti => {
      // Filter by date
      if (ti.taxDate < startDate || ti.taxDate > endDate) return false;
      // Filter by vatType (taxKind)
      if (vatType === '1' && ti.taxKind === '2') return false;
      if (vatType === '2' && ti.taxKind === '1') return false;
      // Filter by customer name
      if (searchCustomer.trim()) {
        if (!ti.customerName.includes(searchCustomer.trim())) return false;
      }
      return true;
    }).sort((a, b) => a.taxDate.localeCompare(b.taxDate));
  }, [taxInvoices, startDate, endDate, vatType, searchCustomer, viewMode]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. Totals computation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const totals = useMemo(() => {
    if (viewMode === 'aggregate') {
      return aggregatedData.reduce(
        (acc, row) => ({
          amount: acc.amount + row.amount,
          tax: acc.tax + row.tax,
          total: acc.total + row.total,
          count: acc.count + row.slipCount
        }),
        { amount: 0, tax: 0, total: 0, count: 0 }
      );
    } else {
      return filteredHistoryData.reduce(
        (acc, row) => ({
          amount: acc.amount + row.supplyAmount,
          tax: acc.tax + row.taxAmount,
          total: acc.total + row.totalAmount,
          count: acc.count + 1
        }),
        { amount: 0, tax: 0, total: 0, count: 0 }
      );
    }
  }, [aggregatedData, viewMode]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 8. History (기존 세금계산서 이력) filtered data
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const themeBorder = osTheme === 'winxp-retro' ? 'border-[#808080]' : 'border-slate-300';
  const themeHeaderBg = osTheme === 'winxp-retro' ? 'bg-[#ece9d8]' : 'bg-slate-100';

  // Current display data depends on viewMode
  const currentData = viewMode === 'aggregate' ? aggregatedData : filteredHistoryData;
  const currentIds = viewMode === 'aggregate' 
    ? aggregatedData.map(d => d.id) 
    : filteredHistoryData.map(d => d.id);

  return (
    <div className={`h-[calc(100vh-140px)] flex flex-col ${osTheme === 'winxp-retro' ? 'bg-[#d4d0c8]' : 'bg-white'} border ${themeBorder} shadow-sm overflow-hidden text-sm`}>
      {/* 1. Header Toolbar (OkSale Style) */}
      <div className={`p-2 border-b ${themeBorder} ${themeHeaderBg} flex flex-wrap gap-x-4 gap-y-2 items-center text-xs font-semibold`}>
        {/* Title / Logo simulation */}
        <div className="flex items-center gap-1 mr-2 text-blue-800 font-bold">
          <FileDigit className="w-4 h-4" />
          기간별 세금계산서
        </div>

        <div className="flex items-center gap-1">
          <span className="text-slate-700">부가세종류</span>
          <select 
            value={vatType} onChange={e => setVatType(e.target.value)}
            className={`border ${themeBorder} px-1 py-0.5 bg-white`}
          >
            <option value="1">1 매출부가세</option>
            <option value="2">2 매입부가세</option>
          </select>
        </div>

        <div className="flex items-center gap-2 border-l border-r border-slate-300 px-3">
          <span className="text-slate-700">합산방법</span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" name="sumMethod" checked={sumMethod === 'customer'} onChange={() => setSumMethod('customer')} />
            거래처별
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" name="sumMethod" checked={sumMethod === 'site'} onChange={() => setSumMethod('site')} />
            현장별
          </label>
        </div>

        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1 cursor-pointer text-blue-700">
            <input type="checkbox" checked={printSiteName} onChange={e => setPrintSiteName(e.target.checked)} />
            계산서현장명인쇄
          </label>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 border-l border-slate-300 pl-3">
          <span className="text-slate-600 mr-1">조회</span>
          <button
            onClick={() => setViewMode('aggregate')}
            className={`px-2 py-0.5 rounded-sm border text-[11px] ${viewMode === 'aggregate' ? 'bg-blue-600 text-white border-blue-700' : `bg-white ${themeBorder} hover:bg-slate-50`}`}
          >
            전표집계
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-2 py-0.5 rounded-sm border text-[11px] ${viewMode === 'history' ? 'bg-blue-600 text-white border-blue-700' : `bg-white ${themeBorder} hover:bg-slate-50`}`}
          >
            발행이력({taxInvoices.length.toLocaleString()})
          </button>
        </div>
      </div>

      <div className={`p-2 border-b ${themeBorder} ${themeHeaderBg} flex flex-wrap gap-4 items-center text-xs`}>
        <div className="flex items-center gap-1">
          <span className="font-semibold text-slate-700 w-10">기 간</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={`border ${themeBorder} px-1 py-0.5 w-28`} />
          <span>-</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={`border ${themeBorder} px-1 py-0.5 w-28`} />
        </div>

        <div className="flex items-center gap-1">
          <span className="font-semibold text-slate-700">거래처명</span>
          <input type="text" value={searchCustomer} onChange={e => setSearchCustomer(e.target.value)} className={`border ${themeBorder} px-2 py-0.5 w-40`} placeholder="거래처명 검색..." />
        </div>

        <div className="flex items-center gap-2 ml-auto text-[11px] text-slate-500">
          <span>전표 총 {slips.length.toLocaleString()}건</span>
          <span className="text-slate-300">|</span>
          <span>매출 {slips.filter(s => s.slipType.toUpperCase() === 'SALES').length.toLocaleString()}건</span>
          <span className="text-slate-300">|</span>
          <span>기존 세금계산서 {taxInvoices.length.toLocaleString()}건</span>
        </div>
      </div>

      {/* 2. Data Grid */}
      <div className="flex-1 overflow-auto bg-white relative">
        <table className="w-full text-left text-xs border-collapse font-sans table-fixed">
          <colgroup>
            <col className="w-10" />
            {viewMode === 'aggregate' && <col className="w-14" />}
            <col className="w-[25%]" />
            <col className="w-[20%]" />
            <col className="w-28" />
            <col className="w-24" />
            <col className="w-28" />
            {viewMode === 'aggregate' && <col className="w-16" />}
          </colgroup>
          <thead className={`sticky top-0 z-10 ${osTheme === 'winxp-retro' ? 'bg-[#ece9d8]' : 'bg-slate-100'}`}>
            <tr className={`border-b ${themeBorder} text-center font-bold text-slate-700`}>
              <th className={`border-r ${themeBorder} py-1.5`}><input type="checkbox" onChange={(e) => {
                if (e.target.checked) setSelectedIds(new Set(currentIds));
                else setSelectedIds(new Set());
              }} checked={currentData.length > 0 && selectedIds.size === currentData.length} /></th>
              {viewMode === 'aggregate' && <th className={`border-r ${themeBorder} px-1 py-1.5 text-[10px]`}>영수/청구</th>}
              <th className={`border-r ${themeBorder} px-2 py-1.5`}>거래처명</th>
              <th className={`border-r ${themeBorder} px-2 py-1.5`}>{viewMode === 'aggregate' ? '현장명' : '품목요약'}</th>
              <th className={`border-r ${themeBorder} px-2 py-1.5`}>금 액</th>
              <th className={`border-r ${themeBorder} px-2 py-1.5`}>세 액</th>
              <th className={`${viewMode === 'aggregate' ? `border-r ${themeBorder}` : ''} px-2 py-1.5`}>합 계</th>
              {viewMode === 'aggregate' && <th className={`px-1 py-1.5 text-[10px]`}>전표수</th>}
            </tr>
          </thead>
          <tbody>
            {viewMode === 'aggregate' ? (
              /* ━━━ Aggregate View ━━━ */
              aggregatedData.map((row) => (
                <tr 
                  key={row.id} 
                  className={`border-b border-slate-100 hover:bg-blue-50 cursor-pointer ${selectedIds.has(row.id) ? 'bg-blue-100' : ''}`}
                  onClick={() => toggleSelect(row.id)}
                >
                  <td className={`border-r ${themeBorder} text-center py-1`} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} />
                  </td>
                  <td className={`border-r ${themeBorder} text-center py-1`} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleCheckReceipt(row.id)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                        row.checkReceipt === '영수' 
                          ? 'bg-blue-50 text-blue-700 border-blue-300' 
                          : 'bg-orange-50 text-orange-700 border-orange-300'
                      }`}
                    >
                      {row.checkReceipt}
                    </button>
                  </td>
                  <td className={`border-r ${themeBorder} px-2 py-1 truncate ${selectedIds.has(row.id) ? 'font-bold text-blue-700' : ''}`} title={row.customerName}>
                    {row.customerName}
                  </td>
                  <td className={`border-r ${themeBorder} px-2 py-1 truncate`} title={row.siteName}>{row.siteName}</td>
                  <td className={`border-r ${themeBorder} px-2 py-1 text-right text-slate-700 font-mono tabular-nums`}>{formatKRW(row.amount)}</td>
                  <td className={`border-r ${themeBorder} px-2 py-1 text-right text-slate-700 font-mono tabular-nums`}>{formatKRW(row.tax)}</td>
                  <td className={`border-r ${themeBorder} px-2 py-1 text-right font-mono font-bold text-blue-700 tabular-nums`}>{formatKRW(row.total)}</td>
                  <td className="px-1 py-1 text-center text-slate-500 text-[10px]">{row.slipCount}건</td>
                </tr>
              ))
            ) : (
              /* ━━━ History View ━━━ */
              filteredHistoryData.map((row) => (
                <tr 
                  key={row.id} 
                  className={`border-b border-slate-100 hover:bg-blue-50 cursor-pointer ${selectedIds.has(row.id) ? 'bg-blue-100' : ''}`}
                  onClick={() => toggleSelect(row.id)}
                >
                  <td className={`border-r ${themeBorder} text-center py-1`} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} />
                  </td>
                  <td className={`border-r ${themeBorder} px-2 py-1 truncate ${selectedIds.has(row.id) ? 'font-bold text-blue-700' : ''}`} title={row.customerName}>
                    {row.customerName}
                  </td>
                  <td className={`border-r ${themeBorder} px-2 py-1 truncate`} title={row.productSummary}>{row.productSummary}</td>
                  <td className={`border-r ${themeBorder} px-2 py-1 text-right text-slate-700 font-mono tabular-nums`}>{formatKRW(row.supplyAmount)}</td>
                  <td className={`border-r ${themeBorder} px-2 py-1 text-right text-slate-700 font-mono tabular-nums`}>{formatKRW(row.taxAmount)}</td>
                  <td className="px-2 py-1 text-right font-mono font-bold text-blue-700 tabular-nums">{formatKRW(row.totalAmount)}</td>
                </tr>
              ))
            )}
            {/* Empty padding rows for retro feel */}
            {currentData.length < 15 && [...Array(15 - currentData.length)].map((_, i) => (
              <tr key={`empty-${i}`} className="border-b border-slate-50 h-[26px]">
                <td className={`border-r ${themeBorder}`}></td>
                {viewMode === 'aggregate' && <td className={`border-r ${themeBorder}`}></td>}
                <td className={`border-r ${themeBorder}`}></td>
                <td className={`border-r ${themeBorder}`}></td>
                <td className={`border-r ${themeBorder}`}></td>
                <td className={`border-r ${themeBorder}`}></td>
                <td className={viewMode === 'aggregate' ? `border-r ${themeBorder}` : ''}></td>
                {viewMode === 'aggregate' && <td></td>}
              </tr>
            ))}
          </tbody>
          {/* ━━━ 합계 행 (Totals Row) ━━━ */}
          <tfoot className={`sticky bottom-0 z-10 ${osTheme === 'winxp-retro' ? 'bg-[#e8e4d0]' : 'bg-blue-50'}`}>
            <tr className={`border-t-2 ${themeBorder} text-xs font-bold`}>
              <td className={`border-r ${themeBorder} text-center py-1.5 text-slate-500`}>합계</td>
              {viewMode === 'aggregate' && <td className={`border-r ${themeBorder} text-center py-1.5 text-slate-500`}>{currentData.length}건</td>}
              <td className={`border-r ${themeBorder} px-2 py-1.5 text-blue-800`}>
                거래처 {viewMode === 'aggregate' ? aggregatedData.length : new Set(filteredHistoryData.map(d => d.customerName)).size}개사
              </td>
              <td className={`border-r ${themeBorder} px-2 py-1.5 text-slate-500`}>
                {viewMode === 'aggregate' ? `전표 ${totals.count}건` : `${filteredHistoryData.length}건`}
              </td>
              <td className={`border-r ${themeBorder} px-2 py-1.5 text-right font-mono tabular-nums text-slate-800`}>{formatKRW(totals.amount)}</td>
              <td className={`border-r ${themeBorder} px-2 py-1.5 text-right font-mono tabular-nums text-slate-800`}>{formatKRW(totals.tax)}</td>
              <td className={`${viewMode === 'aggregate' ? `border-r ${themeBorder}` : ''} px-2 py-1.5 text-right font-mono tabular-nums text-blue-800 text-sm`}>{formatKRW(totals.total)}</td>
              {viewMode === 'aggregate' && <td className="px-1 py-1.5 text-center text-slate-500 text-[10px]">{totals.count}건</td>}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 3. Footer Buttons (OkSale Style) */}
      <div className={`p-1 border-t ${themeBorder} ${themeHeaderBg} flex justify-between gap-1 text-xs font-bold`}>
        <div className="flex gap-1">
          <button onClick={() => {
            if (viewMode === 'aggregate') setSelectedIds(new Set(aggregatedData.map(d => d.id)));
            else setSelectedIds(new Set(filteredHistoryData.map(d => d.id)));
          }} className={`px-3 py-1 bg-slate-200 border ${themeBorder} hover:bg-slate-300 rounded-sm`}>
            전체선택F11
          </button>
          <button onClick={() => setSelectedIds(new Set())} className={`px-3 py-1 bg-slate-200 border ${themeBorder} hover:bg-slate-300 rounded-sm`}>
            전체해제F12
          </button>
        </div>
        
        <div className="flex gap-1">
          <button onClick={handleReceivablesF4} className={`px-3 py-1 bg-slate-200 border ${themeBorder} hover:bg-slate-300 rounded-sm`}>
            미수미지F4
          </button>
          <button onClick={handlePrintF9} className={`px-3 py-1 bg-blue-100 border border-blue-400 text-blue-800 hover:bg-blue-200 rounded-sm`}>
            계산서F9
          </button>
          <button className={`px-3 py-1 bg-slate-200 border ${themeBorder} hover:bg-slate-300 rounded-sm opacity-50 cursor-not-allowed`} title="명세서 인쇄 기능은 슬립 화면의 인쇄 기능을 이용하세요.">
            명세서F8
          </button>
          <button onClick={handleSearch} className={`px-3 py-1 bg-slate-200 border ${themeBorder} hover:bg-slate-300 rounded-sm`}>
            검색F2
          </button>
          <button onClick={handleEsc} className={`px-3 py-1 bg-slate-200 border ${themeBorder} hover:bg-slate-300 rounded-sm`}>
            종료Esc
          </button>
        </div>
      </div>

      {/* 4. Tax Print Modal */}
      <TaxPrintModal
        invoices={printInvoices}
        config={config}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />

      {/* 5. 미수미지F4 Modal */}
      {showReceivablesModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={() => setShowReceivablesModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl w-[500px] max-h-[60vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                미수금 / 미지급금 현황
              </h3>
              <button onClick={() => setShowReceivablesModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                    <th className="px-3 py-2 text-left">거래처명</th>
                    <th className="px-3 py-2 text-right">미수금(원)</th>
                    <th className="px-3 py-2 text-right">미지급금(원)</th>
                  </tr>
                </thead>
                <tbody>
                  {receivablesData.length > 0 ? receivablesData.map((d, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-medium">{d.customerName}</td>
                      <td className={`px-3 py-1.5 text-right font-mono tabular-nums ${d.receivables > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                        {d.receivables > 0 ? formatKRW(d.receivables) : '-'}
                      </td>
                      <td className={`px-3 py-1.5 text-right font-mono tabular-nums ${d.payables > 0 ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                        {d.payables > 0 ? formatKRW(d.payables) : '-'}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                        미수/미지급 데이터가 없습니다. 먼저 [검색F2]를 실행하세요.
                      </td>
                    </tr>
                  )}
                </tbody>
                {receivablesData.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-bold bg-slate-50">
                      <td className="px-3 py-2">합계</td>
                      <td className="px-3 py-2 text-right font-mono text-red-700">
                        {formatKRW(receivablesData.reduce((s, d) => s + d.receivables, 0))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-blue-700">
                        {formatKRW(receivablesData.reduce((s, d) => s + (d.payables || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
              <button onClick={() => setShowReceivablesModal(false)} className="px-4 py-1.5 bg-slate-100 border border-slate-300 rounded text-xs font-medium hover:bg-slate-200">
                닫기 (Esc)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
