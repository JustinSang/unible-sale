'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BRAND } from '@/lib/brand';
import { Header } from '@/components/Header';
import { SideRail } from '@/components/SideRail';
import { SlipEntryView } from '@/components/SlipEntryView';
import { ProductMasterView } from '@/components/ProductMasterView';
import { CustomerMasterView } from '@/components/CustomerMasterView';
import { CollectionPaymentView } from '@/components/CollectionPaymentView';
import { TaxInvoiceView } from '@/components/TaxInvoiceView';
import { BillManagementView } from '@/components/BillManagementView';
import { DeliveryView } from '@/components/DeliveryView';
import { InventoryLedgerView } from '@/components/InventoryLedgerView';
import { LedgerReportsView } from '@/components/LedgerReportsView';
import { MdbAnalyzerView } from '@/components/MdbAnalyzerView';
import { CloudSyncAndIniView } from '@/components/CloudSyncAndIniView';
import { PrintModal } from '@/components/PrintModal';
import { PdfBundleModal } from '@/components/PdfBundleModal';
import { AdminPinModal } from '@/components/AdminPinModal';
import type {
  Product,
  Customer,
  Slip,
  DeliveryOrder,
  InventoryLog,
  SystemConfig,
  OSTheme,
  Bill,
  TaxInvoice,
  CollectionPayment
} from '@/types';

// 미동이엔씨 연동 화면은 동산화스너 배포에서만 불러온다(다른 고객사 빌드에는 코드·문구가 들어가지 않는다 — lib/brand.ts 와 같은 방식).
/* eslint-disable @typescript-eslint/no-require-imports */
const MidongOrdersView: typeof import('@/components/MidongOrdersView').MidongOrdersView | null = (process.env.NEXT_PUBLIC_TENANT || 'dongsan') === 'dongsan' ? require('@/components/MidongOrdersView').MidongOrdersView : null;
/* eslint-enable @typescript-eslint/no-require-imports */

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('slips');
  const [osTheme, setOsTheme] = useState<OSTheme>('modern-win');

  // Database States
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [taxInvoices, setTaxInvoices] = useState<TaxInvoice[]>([]);
  const [collections, setCollections] = useState<CollectionPayment[]>([]);
  const [config, setConfig] = useState<SystemConfig>({
    dbPath: 'c:\\OkSale\\Data\\',
    reportPath: 'c:\\OkSale\\Data\\',
    printers: {
      slipPrinter: '삼성 BIOLON 80mm 영수증 프린터',
      taxPrinter: 'EPSON LQ-690K 도트 프린터',
      printer: 'HP LaserJet Pro M404'
    },
    cloudSyncEnabled: true,
    syncIntervalSec: 15,
    lastSyncTime: new Date().toISOString(),
    companyInfo: {
      ...BRAND.companyDefaultsPage
    }
  });

  // Sync & UI States
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toISOString());
  const [online, setOnline] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Print Modal State
  const [isPrintOpen, setIsPrintOpen] = useState<boolean>(false);
  const [printSlip, setPrintSlip] = useState<Slip | null>(null);
  const [bundleSlips, setBundleSlips] = useState<Slip[] | null>(null);
  // 관리자 모드(발송된 전표도 수정·삭제 가능) — 이 브라우저 탭에서만 유지(sessionStorage)
  const [adminMode, setAdminMode] = useState<boolean>(false);
  const [pinOpen, setPinOpen] = useState<boolean>(false);
  useEffect(() => { try { if (sessionStorage.getItem('oksale.admin') === '1') setAdminMode(true); } catch { /* 저장소 없음 */ } }, []);
  const turnAdmin = (on: boolean) => { setAdminMode(on); try { on ? sessionStorage.setItem('oksale.admin', '1') : sessionStorage.removeItem('oksale.admin'); } catch { /* 무시 */ } };
  const handleToggleAdmin = () => { if (adminMode) turnAdmin(false); else setPinOpen(true); };
  const handleSetPin = async (hash: string) => {
    const cur = await fetch('/api/config').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
    await fetch('/api/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...cur, adminPinHash: hash }) });
    setConfig(prev => ({ ...prev, adminPinHash: hash }));
  };
  // 발송(팩스·이메일·카카오) 성공을 화면 전표 목록에도 바로 반영
  const handleDispatched = (slipId: string, ds: any) => setSlips(prev => prev.map(s => (s.id === slipId ? { ...s, dispatchStatus: ds } : s)));
  // Ref to track isPrintOpen inside event handlers without causing useEffect deps change
  const isPrintOpenRef = useRef(isPrintOpen);
  useEffect(() => { isPrintOpenRef.current = isPrintOpen; }, [isPrintOpen]);

  const seenCountsRef = useRef<string>('');
  const [customerPrices, setCustomerPrices] = useState<Record<string, Record<string, any>>>({});

  // Fetch full data from server API (supports silent background sync)
  const fetchFullData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const res = await fetch('/api/init-data');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setCustomers(data.customers || []);
        setSlips(data.slips || []);
        setCustomerPrices(data.customerPrices || {});
        seenCountsRef.current = `${(data.products || []).length}|${(data.customers || []).length}|${(data.slips || []).length}`;
        setDeliveries(data.deliveries || []);
        setInventoryLogs(data.inventoryLogs || []);
        setBills(data.bills || []);
        setTaxInvoices(data.taxInvoices || []);
        setCollections(data.collections || []);
        if (data.config && Object.keys(data.config).length > 0) {
          setConfig(prev => ({ 
            ...prev, 
            ...data.config,
            companyInfo: { ...prev.companyInfo, ...(data.config.companyInfo || {}) },
            printers: { ...prev.printers, ...(data.config.printers || {}) }
          }));
        }
        setLastSyncTime(new Date().toISOString());
        setOnline(true);
      }
    } catch (err) {
      console.warn('Server offline or network glitch:', err);
      setOnline(false);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  // 배경 동기화는 건수만 확인하고, 달라졌을 때만 전체(약 9MB)를 다시 받는다 — 무료 DB 전송 한도 보호.
  const checkAndSync = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    try {
      const res = await fetch('/api/sync-check');
      if (!res.ok) return;
      const c = await res.json();
      if (`${c.products}|${c.customers}|${c.slips}` !== seenCountsRef.current) await fetchFullData(true);
    } catch {
      setOnline(false);
    }
  }, [fetchFullData]);

  // Initial load
  useEffect(() => {
    fetchFullData(false);
  }, [fetchFullData]);

  // Realtime Live Multi-Device Auto-Sync:
  // Focus/visibility sync is SUPPRESSED when print modal is open to prevent
  // alert() -> focus -> re-render -> modal disappearing in 0.1s
  useEffect(() => {
    // 0) Server-Sent Events (SSE) Instant Real-Time Push Stream
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('update', () => {
        if (!isPrintOpenRef.current) checkAndSync();
      });
      eventSource.onerror = () => {};
    } catch (e) {
      console.warn('SSE stream unavailable:', e);
    }

    // 1) Periodic background polling fallback (every 15 seconds, suppressed when modal is open)
    const intervalSec = Math.max(60, config.syncIntervalSec || 60);
    const interval = setInterval(() => {
      if (!isPrintOpenRef.current) checkAndSync();
    }, intervalSec * 1000);

    // 2) Focus & visibility sync — DEBOUNCED and suppressed when modal open
    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    const handleFocus = () => {
      if (isPrintOpenRef.current) return; // Don't sync while modal is open
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => checkAndSync(), 2000); // 2s debounce
    };
    const handleVisibilityChange = () => {
      if (isPrintOpenRef.current) return;
      if (document.visibilityState === 'visible') {
        if (focusTimer) clearTimeout(focusTimer);
        focusTimer = setTimeout(() => checkAndSync(), 2000);
      }
    };

    // 3) Network online/offline
    const handleOnline = () => {
      setOnline(true);
      if (!isPrintOpenRef.current) checkAndSync();
    };
    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
      if (focusTimer) clearTimeout(focusTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [config.syncIntervalSec, fetchFullData, checkAndSync]);

  // Manual Sync trigger
  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualTrigger: true })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setProducts(data.data.products || []);
          setCustomers(data.data.customers || []);
          setSlips(data.data.slips || []);
          setDeliveries(data.data.deliveries || []);
          setInventoryLogs(data.data.inventoryLogs || []);
          setBills(data.data.bills || []);
          setTaxInvoices(data.data.taxInvoices || []);
          setCollections(data.data.collections || []);
        }
        setLastSyncTime(new Date().toISOString());
        setOnline(true);
      }
    } catch (err) {
      console.error('Sync failed:', err);
      setOnline(false);
    } finally {
      setTimeout(() => setIsSyncing(false), 400);
    }
  };

  // Collection Actions
  const handleAddCollection = async (data: any) => {
    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      await fetchFullData();
    }
  };

  // Tax Invoice Actions
  const handleAddTaxInvoice = async (data: Partial<TaxInvoice>) => {
    const res = await fetch('/api/tax-invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const newTax = await res.json();
      setTaxInvoices(prev => [newTax, ...prev]);
    }
  };

  // Bill Actions
  const handleAddBill = async (data: Partial<Bill>) => {
    const res = await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const newBill = await res.json();
      setBills(prev => [newBill, ...prev]);
    }
  };

  const handleUpdateBill = async (id: string, patch: Partial<Bill>) => {
    const res = await fetch(`/api/bills/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || '어음 수정에 실패했습니다.'); }
    setBills(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)));
  };
  const handleDeleteBill = async (id: string) => {
    const res = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || '어음 삭제에 실패했습니다.'); }
    setBills(prev => prev.filter(b => b.id !== id));
  };

  // Product Actions
  const handleAddProduct = async (p: Partial<Product>) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    });
    if (res.ok) {
      const newProd = await res.json();
      setProducts(prev => [newProd, ...prev]);
    }
  };

  const handleUpdateProduct = async (id: string, p: Partial<Product>) => {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    });
    if (res.ok) {
      // PUT 응답은 {success:true}뿐이라(품목 전체가 아님) 보낸 변경분을 기존 품목에 합친다 — 응답으로 바꾸면 수정한 품목이 깨져 화면이 멈춘다.
      setProducts(prev => prev.map(prod => (prod.id === id ? { ...prod, ...p } : prod)));
    } else {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || '품목 수정에 실패했습니다.');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setProducts(prev => prev.filter(p => p.id !== id));
    }
  };

  // Customer Actions
  const handleAddCustomer = async (c: Partial<Customer>) => {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c)
    });
    if (res.ok) {
      const newCust = await res.json();
      setCustomers(prev => [newCust, ...prev]);
    }
  };

  // 전표 입력 중 거래처 즉시 등록(원본: 거래처 목록에서 Insert) — 만든 거래처를 돌려줘 바로 선택하게 한다.
  const handleQuickAddCustomer = async (c: Partial<Customer>): Promise<Customer | undefined> => {
    const res = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    if (!res.ok) return undefined;
    const newCust = await res.json();
    setCustomers(prev => [newCust, ...prev]);
    return newCust;
  };

  const handleUpdateCustomer = async (id: string, c: Partial<Customer>) => {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c)
    });
    if (res.ok) {
      setCustomers(prev => prev.map(cust => (cust.id === id ? { ...cust, ...c } : cust)));
    } else {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || '거래처 수정에 실패했습니다.');
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setCustomers(prev => prev.filter(c => c.id !== id));
    }
  };

  // Slip Actions
  // CRITICAL: Must use fetchFullData(true) (silent=true) to prevent
  // isLoading=true from unmounting SlipEntryView and killing all its state
  const handleSaveSlip = async (slipData: Partial<Slip>, deliveryInfo?: any): Promise<Slip> => {
    const res = await fetch('/api/slips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...slipData, deliveryInfo })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '전표 저장 실패');
    }
    const savedSlip: Slip = await res.json();
    await fetchFullData(true); // silent=true: prevents loading spinner from unmounting child components
    return savedSlip;
  };

  const handleDeleteSlip = async (id: string) => {
    if (!confirm('이 전표를 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/slips/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchFullData(true); // silent=true
    }
  };

  // Delivery Actions
  const handleUpdateDelivery = async (id: string, updates: Partial<DeliveryOrder>) => {
    const res = await fetch(`/api/deliveries/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (res.ok) {
      const updated = await res.json();
      setDeliveries(prev => prev.map(d => (d.id === id ? updated : d)));
    }
  };

  // Stock Adjustment
  const handleStockAdjust = async (productId: string, adjustQty: number, reason: string) => {
    const res = await fetch('/api/stock-adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, adjustQty, reason })
    });
    if (res.ok) {
      await fetchFullData();
    }
  };

  // Config Actions
  const handleUpdateConfig = async (newCfg: Partial<SystemConfig>) => {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCfg)
    });
    if (res.ok) {
      const saved = await res.json();
      setConfig(saved);
    }
  };

  // Reset demo
  const handleResetDemo = async () => {
    if (!confirm(`${BRAND.company} UNIBLE SALE 기본 표준 데이터로 복원하시겠습니까?`)) return;
    const res = await fetch('/api/reset-demo', { method: 'POST' });
    if (res.ok) {
      await fetchFullData();
      alert('데이터가 성공적으로 초기화되었습니다.');
    }
  };

  // Print Modal
  const handleOpenPrint = (slip: Slip) => {
    setPrintSlip(slip);
    setIsPrintOpen(true);
  };

  // Totals for metrics
  const totalReceivables = customers.reduce((s, c) => s + (c.receivables || 0), 0);

  // Theme Wrapper Styles
  const themeClasses: Record<OSTheme, string> = {
    'modern-win': 'font-sans bg-slate-100 text-slate-900',
    'macos': 'font-sans bg-[#f3f4f6] text-slate-900',
    'winxp-retro': 'font-sans bg-[#d4d0c8] text-black border-t-4 border-blue-600'
  };

  return (
    <div className={`min-h-screen ${themeClasses[osTheme]} flex flex-col`}>
      {/* OS Retro Banner when Windows XP Retro is active */}
      {osTheme === 'winxp-retro' && (
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 text-white px-4 py-1 text-xs flex justify-between items-center font-bold tracking-tight shadow-xs select-none">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>UNIBLE SALE v3.5 Enterprise Cloud [초고속 FarPoint Spread 그리드 가동 중]</span>
          </div>
          <span className="text-[10px] text-blue-200">FarPoint Spread 3.0 Grid Native Emulated</span>
        </div>
      )}

      {/* Global Application Header */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        adminMode={adminMode}
        onToggleAdmin={handleToggleAdmin}
        osTheme={osTheme}
        onThemeChange={setOsTheme}
        isSyncing={isSyncing}
        onManualSync={handleManualSync}
        lastSyncTime={lastSyncTime}
        online={online}
        totalProducts={products.length}
        totalCustomers={customers.length}
        totalReceivables={totalReceivables}
      />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
        {isLoading ? (
          <div className="py-20 text-center text-slate-500">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="font-semibold text-sm">{BRAND.company} 클라우드 ERP 데이터베이스를 불러오는 중...</p>
          </div>
        ) : (
          <>
            {currentTab === 'slips' && (
              <SlipEntryView
                products={products}
                customers={customers}
                slips={slips}
                onSaveSlip={handleSaveSlip}
                onDeleteSlip={handleDeleteSlip}
                onOpenPrint={handleOpenPrint}
                onBundlePdf={setBundleSlips}
                adminMode={adminMode}
                onNavigateTab={setCurrentTab}
                onQuickAddCustomer={handleQuickAddCustomer}
                osTheme={osTheme}
                calc={config.calc}
              />
            )}

            {currentTab === 'products' && (
              <ProductMasterView
                products={products}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                osTheme={osTheme}
              />
            )}

            {currentTab === 'customers' && (
              <CustomerMasterView
                customers={customers}
                slips={slips}
                onAddCustomer={handleAddCustomer}
                onUpdateCustomer={handleUpdateCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                osTheme={osTheme}
              />
            )}

            {currentTab === 'collections' && (
              <CollectionPaymentView
                customers={customers}
                collections={collections}
                slips={slips}
                onAddCollection={handleAddCollection}
                osTheme={osTheme}
              />
            )}

            {currentTab === 'tax_invoices' && (
              <TaxInvoiceView
                customers={customers}
                taxInvoices={taxInvoices}
                slips={slips}
                config={config}
                onAddTaxInvoice={handleAddTaxInvoice}
                onNavigateTab={setCurrentTab}
                osTheme={osTheme}
              />
            )}

            {currentTab === 'bills' && (
              <BillManagementView
                bills={bills}
                customers={customers}
                onAddBill={handleAddBill}
                onUpdateBill={handleUpdateBill}
                onDeleteBill={handleDeleteBill}
                osTheme={osTheme}
              />
            )}

            {currentTab === 'delivery' && (
              <DeliveryView
                deliveries={deliveries}
                onUpdateDelivery={handleUpdateDelivery}
                osTheme={osTheme}
              />
            )}

            {currentTab === 'inventory' && (
              <InventoryLedgerView
                logs={inventoryLogs}
                products={products}
                onStockAdjust={handleStockAdjust}
                osTheme={osTheme}
              />
            )}

            {currentTab === 'mdb_tool' && (
              <MdbAnalyzerView
                onRefreshData={fetchFullData}
                osTheme={osTheme}
              />
            )}

            {currentTab === 'midong' && MidongOrdersView && <MidongOrdersView slips={slips} onSlipsChanged={() => fetchFullData(true)} />}

            {currentTab === 'ledgers' && (
              <LedgerReportsView
                slips={slips}
                collections={collections}
                customers={customers}
                taxInvoices={taxInvoices}
                products={products}
                bills={bills}
                company={config?.companyInfo}
                customerPrices={customerPrices}
                osTheme={osTheme}
              />
            )}

            {currentTab === 'ini_sync' && (
              <CloudSyncAndIniView
                config={config}
                onUpdateConfig={handleUpdateConfig}
                onManualSync={handleManualSync}
                isSyncing={isSyncing}
                lastSyncTime={lastSyncTime}
                onResetDemo={handleResetDemo}
                osTheme={osTheme}
              />
            )}
          </>
        )}
      </main>

      {/* 오른쪽 아이콘 줄 */}
      <SideRail currentTab={currentTab} onTabChange={setCurrentTab} />

      {/* Print Document Modal */}
      {pinOpen && <AdminPinModal pinHash={config.adminPinHash} onSetPin={handleSetPin} onUnlocked={() => { turnAdmin(true); setPinOpen(false); }} onClose={() => setPinOpen(false)} />}
      {bundleSlips && <PdfBundleModal slips={bundleSlips} config={config} customers={customers} onClose={() => setBundleSlips(null)} />}
      <PrintModal
        slip={printSlip}
        config={config}
        customer={customers.find(c => c.id === printSlip?.customerId)}
        customers={customers}
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        onDispatched={handleDispatched}
      />

      {/* Footer Info Bar */}
      <footer className="border-t border-slate-200 bg-white/80 py-2.5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong>{config?.companyInfo?.name || BRAND.company}</strong> &middot; 사업자번호: {config?.companyInfo?.bizNumber || '-'} &middot; 대표: {config?.companyInfo?.ceo || '-'} &middot; TEL: {config?.companyInfo?.tel || '-'}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            UNIBLE SALE 클라우드 ERP &middot; Windows 10/11 & macOS Universal
          </div>
        </div>
      </footer>
    </div>
  );
}
