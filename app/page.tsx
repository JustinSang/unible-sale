'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { SlipEntryView } from '@/components/SlipEntryView';
import { ProductMasterView } from '@/components/ProductMasterView';
import { CustomerMasterView } from '@/components/CustomerMasterView';
import { CollectionPaymentView } from '@/components/CollectionPaymentView';
import { TaxInvoiceView } from '@/components/TaxInvoiceView';
import { BillManagementView } from '@/components/BillManagementView';
import { DeliveryView } from '@/components/DeliveryView';
import { InventoryLedgerView } from '@/components/InventoryLedgerView';
import { MdbAnalyzerView } from '@/components/MdbAnalyzerView';
import { CloudSyncAndIniView } from '@/components/CloudSyncAndIniView';
import { PrintModal } from '@/components/PrintModal';
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
      name: '동산화스너 (오케이유통 물류센터)',
      bizNumber: '120-81-45678',
      ceo: '홍길동',
      address: '서울특별시 금천구 가산디지털1로 145 에이스하이엔드타워 3차 502호',
      tel: '02-850-7000',
      bizType: '제조 및 도소매',
      bizItem: '볼트, 너트, 화스너 및 철물 일체'
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

  // Fetch full data from server API (supports silent background sync)
  const fetchFullData = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const res = await fetch('/api/data');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setCustomers(data.customers || []);
        setSlips(data.slips || []);
        setDeliveries(data.deliveries || []);
        setInventoryLogs(data.inventoryLogs || []);
        setBills(data.bills || []);
        setTaxInvoices(data.taxInvoices || []);
        setCollections(data.collections || []);
        if (data.config) setConfig(data.config);
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

  // Initial load
  useEffect(() => {
    fetchFullData(false);
  }, [fetchFullData]);

  // Realtime Live Multi-Device Auto-Sync:
  // 1) Periodic interval polling (every 8-15 seconds)
  // 2) Window focus / visibility change sync
  // 3) Online / offline event listeners
  useEffect(() => {
    // 0) Server-Sent Events (SSE) Instant Real-Time Push Stream (< 100ms latency)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('update', () => {
        fetchFullData(true);
      });
      eventSource.onerror = () => {
        // SSE will automatically attempt reconnect; polling serves as fallback
      };
    } catch (e) {
      console.warn('SSE stream unavailable:', e);
    }

    // 1) Periodic background polling fallback (every 8-15 seconds)
    const intervalSec = Math.max(5, config.syncIntervalSec || 8);
    const interval = setInterval(() => {
      fetchFullData(true);
    }, intervalSec * 1000);

    // 2) Focus & visibility sync
    const handleFocus = () => {
      fetchFullData(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchFullData(true);
      }
    };

    // 3) Network online/offline
    const handleOnline = () => {
      setOnline(true);
      fetchFullData(true);
    };
    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [config.syncIntervalSec, fetchFullData]);

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
      const updated = await res.json();
      setProducts(prev => prev.map(prod => (prod.id === id ? updated : prod)));
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

  const handleUpdateCustomer = async (id: string, c: Partial<Customer>) => {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c)
    });
    if (res.ok) {
      const updated = await res.json();
      setCustomers(prev => prev.map(cust => (cust.id === id ? updated : cust)));
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setCustomers(prev => prev.filter(c => c.id !== id));
    }
  };

  // Slip Actions
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
    await fetchFullData();
    return savedSlip;
  };

  const handleDeleteSlip = async (id: string) => {
    const res = await fetch(`/api/slips/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchFullData();
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
    if (!confirm('동산화스너 UNIBLE SALE 기본 표준 데이터로 복원하시겠습니까?')) return;
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
            <p className="font-semibold text-sm">동산화스너 클라우드 ERP 데이터베이스를 불러오는 중...</p>
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
                onNavigateTab={setCurrentTab}
                osTheme={osTheme}
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
                onAddCollection={handleAddCollection}
                osTheme={osTheme}
              />
            )}

            {currentTab === 'tax_invoices' && (
              <TaxInvoiceView
                customers={customers}
                taxInvoices={taxInvoices}
                config={config}
                onAddTaxInvoice={handleAddTaxInvoice}
                osTheme={osTheme}
              />
            )}

            {currentTab === 'bills' && (
              <BillManagementView
                bills={bills}
                customers={customers}
                onAddBill={handleAddBill}
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

      {/* Print Document Modal */}
      <PrintModal
        slip={printSlip}
        config={config}
        customer={customers.find(c => c.id === printSlip?.customerId)}
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
      />

      {/* Footer Info Bar */}
      <footer className="border-t border-slate-200 bg-white/80 py-2.5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong>{config.companyInfo.name}</strong> &middot; 사업자번호: {config.companyInfo.bizNumber} &middot; 대표: {config.companyInfo.ceo} &middot; TEL: {config.companyInfo.tel}
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            UNIBLE SALE 클라우드 ERP &middot; Windows 10/11 & macOS Universal
          </div>
        </div>
      </footer>
    </div>
  );
}
