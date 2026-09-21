'use client';

import React, { useState, useMemo, useDeferredValue, useRef } from 'react';
import {
  Plus,
  Trash2,
  Printer,
  Save,
  RotateCcw,
  Search,
  Truck,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
  HardHat,
  Building,
  X
} from 'lucide-react';
import type { Product, Customer, Slip, SlipItem, SlipType, OSTheme, CustomerSite, DispatchStatus } from '@/types';

interface SlipEntryViewProps {
  products: Product[];
  customers: Customer[];
  slips: Slip[];
  onSaveSlip: (slipData: Partial<Slip>, deliveryInfo?: any) => Promise<Slip>;
  onDeleteSlip: (id: string) => Promise<void>;
  onOpenPrint: (slip: Slip) => void;
  onNavigateTab: (tab: string) => void;
  osTheme: OSTheme;
}

export function SlipEntryView({
  products,
  customers,
  slips,
  onSaveSlip,
  onDeleteSlip,
  onOpenPrint,
  onNavigateTab,
  osTheme
}: SlipEntryViewProps) {
  // Today date format
  const todayStr = new Date().toISOString().slice(0, 10);

  // Form states
  const [slipDate, setSlipDate] = useState<string>(todayStr);
  const [slipType, setSlipType] = useState<SlipType>('SALES');
  const [editingSlipId, setEditingSlipId] = useState<string | null>(null);
  const [linkedFromId, setLinkedFromId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [paymentType, setPaymentType] = useState<'credit' | 'cash' | 'card' | 'mixed'>('credit');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [memo, setMemo] = useState<string>('');

  const [deliveryStatus, setDeliveryStatus] = useState<string>('none');
  const [dispatchStatus, setDispatchStatus] = useState<DispatchStatus | undefined>();
  
  // UX Enhancement: 스마트 재고 전표 보호 (원장 잠금)
  const isLocked = editingSlipId !== null && (
    deliveryStatus === 'delivered' || 
    deliveryStatus === 'shipping' || 
    (dispatchStatus && (dispatchStatus.faxStatus === 'SUCCESS' || dispatchStatus.emailStatus === 'SUCCESS' || dispatchStatus.kakaoStatus === 'SUCCESS'))
  );

  // 1:N Site states for selected customer
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [selectedSiteName, setSelectedSiteName] = useState<string>('');
  const [selectedSiteManager, setSelectedSiteManager] = useState<string>('');
  const [selectedSiteAddress, setSelectedSiteAddress] = useState<string>('');

  // Quick Site Modal
  const [isQuickSiteModalOpen, setIsQuickSiteModalOpen] = useState<boolean>(false);
  const [quickSiteInput, setQuickSiteInput] = useState({
    siteName: '',
    manager: '',
    tel: '',
    address: '',
    memo: ''
  });

  // Delivery options
  const [needDelivery, setNeedDelivery] = useState<boolean>(false);
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryTel, setDeliveryTel] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');

  // Progressive Disclosure State for Site & Delivery
  const [isOptionsExpanded, setIsOptionsExpanded] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dispatch Modal State
  const [dispatchModal, setDispatchModal] = useState<{ isOpen: boolean; channel: 'FAX' | 'KAKAO' | 'EMAIL' | null; contact: string }>({
    isOpen: false,
    channel: null,
    contact: ''
  });

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info', durationMs = 4000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, type });
    toastTimerRef.current = setTimeout(() => setToastMessage(null), durationMs);
  };

  const handleExternalDispatch = async (e: React.MouseEvent, channel: 'FAX' | 'KAKAO' | 'EMAIL') => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingSlipId) {
      showToast('출력 및 전송을 위해 먼저 전표를 저장해주세요.', 'error');
      return;
    }
    const currentSlip = slips.find(s => s.id === editingSlipId);
    if (!currentSlip) {
      showToast('저장된 전표 정보를 찾을 수 없습니다.', 'error');
      return;
    }
    
    // Fallback contact info based on channel
    let defaultContact = '';
    if (channel === 'EMAIL') defaultContact = '고객사메일@example.com';
    if (channel === 'FAX' || channel === 'KAKAO') defaultContact = '010-0000-0000';
    
    setDispatchModal({
      isOpen: true,
      channel,
      contact: defaultContact
    });
  };

  const confirmExternalDispatch = async () => {
    const { channel, contact } = dispatchModal;
    if (!channel || !contact.trim()) {
      showToast('연락처(또는 이메일)를 입력해주세요.', 'error');
      return;
    }

    setDispatchModal(prev => ({ ...prev, isOpen: false }));
    showToast(`${channel === 'FAX' ? '팩스' : channel === 'KAKAO' ? '카카오톡' : '이메일'} 전송을 요청하는 중입니다...`, 'info', 10000);
    
    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slipId: editingSlipId, channel, targetContact: contact.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${channel === 'FAX' ? '팩스' : channel === 'KAKAO' ? '카카오톡' : '이메일'} 발송 성공: ${data.message || '요청이 접수되었습니다.'}`, 'success', 5000);
      } else {
        showToast(`❌ 전송 실패: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast('❌ 네트워크 오류가 발생했습니다.', 'error');
    }
  };

  const handleDownloadExcel = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingSlipId) {
      showToast('엑셀 저장을 위해 먼저 전표를 저장해주세요.', 'error');
      return;
    }
    
    const currentSlip = slips.find(s => s.id === editingSlipId);
    if (!currentSlip || !currentSlip.items) return;
    const suggestedName = `전표_${currentSlip.slipNo || editingSlipId}.xlsx`;
    let handle = null;
    
    if ((window as any).showSaveFilePicker) {
      try {
        handle = await (window as any).showSaveFilePicker({
          suggestedName,
          types: [{ description: 'Excel Workbook', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
        });
      } catch (err: any) {
        if (err.name === 'AbortError') {
           showToast('ℹ️ 저장이 취소되었습니다.', 'info');
           return;
        }
        showToast('❌ 엑셀 저장 권한 오류가 발생했습니다.', 'error');
        return;
      }
    }

    showToast('엑셀 파일을 생성하는 중입니다...', 'info');
    
    try {
      const XLSX = await import('xlsx');
      const wsData = currentSlip.items.map((item, idx) => ({
        'No': idx + 1,
        '품목명': item.productName,
        '규격': item.spec,
        '단위': item.unit,
        '수량': item.qty,
        '단가': item.unitPrice,
        '공급가액': item.supplyAmount,
        '세액': item.taxAmount,
        '합계액': item.totalAmount,
        '비고': item.memo || ''
      }));
      
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "명세서");
      
      if (handle) {
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        showToast('✅ 엑셀 파일이 지정된 위치에 저장되었습니다.', 'success');
      } else {
        XLSX.writeFile(wb, suggestedName);
        showToast('✅ 엑셀 파일이 다운로드되었습니다.', 'success');
      }
    } catch (e) {
      showToast('❌ 엑셀 모듈을 불러오거나 저장 중 오류가 발생했습니다.', 'error');
      console.error(e);
    }
  };

  // Items grid rows
  const [items, setItems] = useState<SlipItem[]>([
    {
      id: 'row-1',
      productId: products[0]?.id || '',
      productCode: products[0]?.code || '',
      productName: products[0]?.name || '',
      spec: products[0]?.spec || '',
      unit: products[0]?.unit || 'BOX',
      qty: 1,
      unitPrice: products[0]?.sellingPrice || 0,
      supplyAmount: products[0]?.sellingPrice || 0,
      taxAmount: Math.round((products[0]?.sellingPrice || 0) * 0.1),
      totalAmount: Math.round((products[0]?.sellingPrice || 0) * 1.1),
      memo: ''
    }
  ]);

  // History search filter
  const [historyStartDate, setHistoryStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [historyEndDate, setHistoryEndDate] = useState<string>(todayStr);
  const [historyFilter, setHistoryFilter] = useState<string>('');
  const deferredHistoryFilter = useDeferredValue(historyFilter);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fast Product Search Modal States (11,000+ items high performance)
  const [isProductSearchOpen, setIsProductSearchOpen] = useState<boolean>(false);
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [productSearchKeyword, setProductSearchKeyword] = useState<string>('');
  const deferredProductSearchKeyword = useDeferredValue(productSearchKeyword);

  // Customer instant search filter
  const [customerSearchFilter, setCustomerSearchFilter] = useState<string>('');
  const deferredCustomerSearchFilter = useDeferredValue(customerSearchFilter);
  const [siteSearchFilter, setSiteSearchFilter] = useState<string>('');
  const deferredSiteSearchFilter = useDeferredValue(siteSearchFilter);

  const filteredCustomersList = useMemo(() => {
    if (!deferredCustomerSearchFilter.trim()) return customers;
    const q = deferredCustomerSearchFilter.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.sites && c.sites.some(s => s.siteName.toLowerCase().includes(q)))
    );
  }, [customers, deferredCustomerSearchFilter]);

  // Auto-select first match if current is not in filtered list
  React.useEffect(() => {
    if (deferredCustomerSearchFilter.trim() && filteredCustomersList.length > 0) {
      const exists = filteredCustomersList.find(c => c.id === selectedCustomerId);
      if (!exists) {
        setSelectedCustomerId(filteredCustomersList[0].id);
        setSelectedSiteId('');
      }
    }
  }, [filteredCustomersList, deferredCustomerSearchFilter, selectedCustomerId]);

  const searchResults = useMemo(() => {
    if (!deferredProductSearchKeyword.trim()) {
      return products.slice(0, 50);
    }
    const q = deferredProductSearchKeyword.toLowerCase();
    const matches: Product[] = [];
    for (const p of products) {
      if (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.spec.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
      ) {
        matches.push(p);
        if (matches.length >= 60) break;
      }
    }
    return matches;
  }, [products, deferredProductSearchKeyword]);

  // Selected customer object
  const currentCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const filteredSitesList = useMemo(() => {
    const sites = currentCustomer?.sites || [];
    if (!deferredSiteSearchFilter.trim()) return sites;
    const q = deferredSiteSearchFilter.toLowerCase();
    return sites.filter(s => 
      s.siteName.toLowerCase().includes(q) || 
      (s.manager && s.manager.toLowerCase().includes(q))
    );
  }, [currentCustomer, deferredSiteSearchFilter]);

  React.useEffect(() => {
    if (deferredSiteSearchFilter.trim() && filteredSitesList.length > 0) {
      const exists = filteredSitesList.find(s => (s.id || s.siteCode) === selectedSiteId);
      if (!exists) {
        const firstId = filteredSitesList[0].id || filteredSitesList[0].siteCode;
        setSelectedSiteId(firstId);
        setSelectedSiteName(filteredSitesList[0].siteName);
        setSelectedSiteManager(filteredSitesList[0].manager || '');
        setSelectedSiteAddress(filteredSitesList[0].address || '');
      }
    }
  }, [filteredSitesList, deferredSiteSearchFilter, selectedSiteId]);

  // Customer-specific agreed prices (Price.mdb)
  const [customerPrices, setCustomerPrices] = useState<Record<string, any>>({});

  // When site changes, update delivery address and slip site states
  const handleSiteSelect = (siteId: string) => {
    setSelectedSiteId(siteId);
    if (!siteId) {
      setSelectedSiteName('');
      setSelectedSiteManager('');
      setSelectedSiteAddress('');
      if (currentCustomer) {
        setDeliveryAddress(currentCustomer.address || '');
        setDeliveryTel(currentCustomer.mobile || currentCustomer.tel || '');
      }
      return;
    }

    const site = currentCustomer?.sites?.find(s => s.id === siteId || s.siteCode === siteId);
    if (site) {
      setSelectedSiteName(site.siteName);
      setSelectedSiteManager(site.manager || '');
      setSelectedSiteAddress(site.address || '');
      if (site.address) setDeliveryAddress(site.address);
      if (site.tel) setDeliveryTel(site.tel);
      setNeedDelivery(true);
      if (!memo) {
        setMemo(`[현장: ${site.siteName}]`);
      }
    }
  };

  // Quick add site from slip entry
  const handleQuickAddSite = () => {
    if (!quickSiteInput.siteName.trim()) {
      alert('현장명을 입력해주세요.');
      return;
    }
    if (!currentCustomer) return;

    const newSiteObj: CustomerSite = {
      id: `site-${Date.now()}`,
      siteCode: `S-${Date.now().toString().slice(-4)}`,
      siteName: quickSiteInput.siteName.trim(),
      manager: quickSiteInput.manager.trim(),
      tel: quickSiteInput.tel.trim(),
      address: quickSiteInput.address.trim(),
      memo: quickSiteInput.memo.trim()
    };

    if (!currentCustomer.sites) currentCustomer.sites = [];
    currentCustomer.sites.push(newSiteObj);

    // Select the new site
    setSelectedSiteId(newSiteObj.id);
    setSelectedSiteName(newSiteObj.siteName);
    setSelectedSiteManager(newSiteObj.manager || '');
    setSelectedSiteAddress(newSiteObj.address || '');
    if (newSiteObj.address) setDeliveryAddress(newSiteObj.address);
    if (newSiteObj.tel) setDeliveryTel(newSiteObj.tel);
    setNeedDelivery(true);
    setMemo(`[현장: ${newSiteObj.siteName}]`);

    // Reset & close quick modal
    setQuickSiteInput({ siteName: '', manager: '', tel: '', address: '', memo: '' });
    setIsQuickSiteModalOpen(false);
  };

  // When customer changes, update delivery address defaults and fetch agreed prices
  const handleCustomerChange = async (cId: string) => {
    setSelectedCustomerId(cId);
    setSelectedSiteId('');
    setSelectedSiteName('');
    setSelectedSiteManager('');
    setSelectedSiteAddress('');
    
    const targetCust = customers.find(c => c.id === cId);
    if (targetCust) {
      setDeliveryAddress(targetCust.address || '');
      setDeliveryTel(targetCust.mobile || targetCust.tel || '');
      // If customer has default sites, don't force select, but let user choose
    }
    try {
      const cleanId = cId.replace(/^c-/, '');
      const res = await fetch(`/api/customer-prices/${cleanId}`);
      if (res.ok) {
        const pData = await res.json();
        setCustomerPrices(pData || {});
      }
    } catch {
      setCustomerPrices({});
    }
  };

  // Helper to resolve product price based on customer's priceTier and agreed prices
  const getProductPrice = (prod: Product, targetCustomer: Customer | undefined = currentCustomer, targetSlipType: SlipType = slipType) => {
    if (targetSlipType === 'PURCHASE' || targetSlipType === 'RETURN_IN') return prod.costPrice;
    
    const tier = targetCustomer?.priceTier || 1;
    let price = prod.sellingPrice;
    if (tier === 2 && prod.sellingPrice2) price = prod.sellingPrice2;
    if (tier === 3 && prod.sellingPrice3) price = prod.sellingPrice3;

    // Apply discount rate if present
    if (prod.discountRate && prod.discountRate > 0) {
      price = price * (1 - prod.discountRate / 100);
    }

    const agreed = customerPrices[prod.code] || customerPrices[prod.id.replace(/^p-/, '')];
    if (agreed) {
      if (agreed.price1 > 0) price = agreed.price1;
      else if (agreed.price2 > 0) price = agreed.price2;
    }
    
    return price;
  };

  // When slip type changes, adjust default pricing (sales -> sellingPrice, purchase -> costPrice)
  const handleSlipTypeChange = (newType: SlipType) => {
    setSlipType(newType);
    setItems(prev =>
      prev.map(it => {
        const prod = products.find(p => p.id === it.productId);
        if (!prod) return it;
        const newUnitPrice = getProductPrice(prod, currentCustomer, newType);
        const supply = Math.round(it.qty * newUnitPrice);
        const tax = Math.round(supply * 0.1);
        return {
          ...it,
          unitPrice: newUnitPrice,
          supplyAmount: supply,
          taxAmount: tax,
          totalAmount: supply + tax
        };
      })
    );
  };

  // Row operations
  const handleItemChange = (idx: number, field: keyof SlipItem, val: any) => {
    setItems(prev => {
      const next = [...prev];
      const target = { ...next[idx], [field]: val };

      // Product selected
      if (field === 'productId') {
        const prod = products.find(p => p.id === val);
        if (prod) {
          target.productId = prod.id;
          target.productCode = prod.code;
          target.productName = prod.name;
          target.spec = prod.spec;
          target.unit = prod.unit;
          const price = getProductPrice(prod);
          
          target.unitPrice = price;
          target.supplyAmount = Math.round(target.qty * price);
          target.taxAmount = Math.round(target.supplyAmount * 0.1);
          target.totalAmount = target.supplyAmount + target.taxAmount;
        }
      }

      // Quantity or UnitPrice changed
      if (field === 'qty' || field === 'unitPrice') {
        const q = field === 'qty' ? Number(val) || 0 : target.qty;
        const p = field === 'unitPrice' ? Number(val) || 0 : target.unitPrice;
        target.supplyAmount = Math.round(q * p);
        target.taxAmount = Math.round(target.supplyAmount * 0.1);
        target.totalAmount = target.supplyAmount + target.taxAmount;
      }

      next[idx] = target;
      return next;
    });
  };

  const handleAddRow = () => {
    const defaultProd = products[0];
    const unitPrice = defaultProd ? getProductPrice(defaultProd) : 0;
    setItems(prev => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        productId: defaultProd?.id || '',
        productCode: defaultProd?.code || '',
        productName: defaultProd?.name || '',
        spec: defaultProd?.spec || '',
        unit: defaultProd?.unit || 'EA',
        qty: 1,
        unitPrice,
        supplyAmount: unitPrice,
        taxAmount: Math.round(unitPrice * 0.1),
        totalAmount: Math.round(unitPrice * 1.1),
        memo: ''
      }
    ]);
  };

  const handleRemoveRow = (idx: number) => {
    if (items.length <= 1) {
      alert('최소 1개 이상의 품목 행이 있어야 합니다.');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Calculations
  const totalSupplyAmount = items.reduce((s, it) => s + (it.supplyAmount || 0), 0);
  const totalTaxAmount = items.reduce((s, it) => s + (it.taxAmount || 0), 0);
  const totalAmount = totalSupplyAmount + totalTaxAmount;
  const prevReceivables = currentCustomer?.receivables || 0;
  const unpaidAmount = Math.max(0, totalAmount - paidAmount);
  const nextReceivables = slipType === 'SALES' ? prevReceivables + unpaidAmount : prevReceivables;

  // Load Slip for Editing
  const handleLoadSlip = (slip: Slip) => {
    setEditingSlipId(slip.id);
    setLinkedFromId(slip.linkedFromId || null);
    setSlipType(slip.slipType);
    setSlipDate(slip.slipDate);
    setSelectedCustomerId(slip.customerId);
    setSelectedSiteId(slip.siteId || '');
    setSelectedSiteName(slip.siteName || '');
    setSelectedSiteManager(slip.siteManager || '');
    setSelectedSiteAddress(slip.siteAddress || '');
    setItems(slip.items.map(it => ({ ...it })));
    setPaymentType(slip.paymentType);
    setPaidAmount(slip.paidAmount);
    setMemo(slip.memo || '');
    
    if (slip.deliveryStatus && slip.deliveryStatus !== 'none') {
      setNeedDelivery(true);
      setIsOptionsExpanded(true);
      setDeliveryStatus(slip.deliveryStatus);
    } else {
      setNeedDelivery(false);
      setDeliveryStatus('none');
    }
    setDispatchStatus(slip.dispatchStatus);
  };

  // Convert Slip for O2C (e.g., ORDER -> DELIVERY)
  const handleConvertSlip = (slip: Slip, targetType: SlipType) => {
    setEditingSlipId(null); // 신규 작성 모드
    setLinkedFromId(slip.id); // 원본 추적
    setSlipType(targetType);
    setSlipDate(new Date().toISOString().split('T')[0]); // 날짜는 오늘로 초기화
    setSelectedCustomerId(slip.customerId);
    setSelectedSiteId(slip.siteId || '');
    setSelectedSiteName(slip.siteName || '');
    setSelectedSiteManager(slip.siteManager || '');
    setSelectedSiteAddress(slip.siteAddress || '');
    setItems(slip.items.map(it => ({ ...it, id: 'row-' + Math.random().toString(36).substr(2, 9) }))); // 새 row ID 부여
    setPaymentType('credit'); // 초기화
    setPaidAmount(0); // 초기화
    setMemo(''); // 메모는 비우거나 원본 유지 가능 (현재는 비움)
    
    // 강제로 우측 폼으로 스크롤 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });
    alert(`[${targetType === 'DELIVERY' ? '납품서' : '거래명세서'}] 변환 준비 완료.\n내용을 확인하고 저장해주세요.`);
  };

  // Save Slip
  const handleSubmitSlip = async () => {
    if (!selectedCustomerId) {
      alert('거래처를 선택해주세요.');
      return;
    }
    if (items.length === 0 || items.some(it => !it.productId || it.qty <= 0)) {
      alert('모든 품목의 수량을 1 이상으로 입력해주세요.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const saved = await onSaveSlip(
        {
          id: editingSlipId || undefined,
          linkedFromId: linkedFromId || undefined,
          slipDate,
          slipType,
          customerId: selectedCustomerId,
          customerName: currentCustomer?.name || '',
          siteId: selectedSiteId,
          siteName: selectedSiteName,
          siteManager: selectedSiteManager,
          siteAddress: selectedSiteAddress,
          items,
          totalSupplyAmount,
          totalTaxAmount,
          totalAmount,
          paymentType,
          paidAmount,
          unpaidAmount,
          prevReceivables,
          memo
        },
        needDelivery
          ? {
              required: true,
              siteId: selectedSiteId,
              siteName: selectedSiteName,
              address: deliveryAddress || selectedSiteAddress || currentCustomer?.address,
              tel: deliveryTel || currentCustomer?.tel,
              driverName: driverName || '미배차',
              requestedDate: slipDate,
              memo: selectedSiteName ? `[현장: ${selectedSiteName}] ${memo}` : memo
            }
          : undefined
      );

      // IMPORTANT: Keep editingSlipId set to saved.id so that
      // fax/kakao/email/pdf/excel buttons can reference the saved slip.
      // The user can manually reset via the "취소" button.
      setEditingSlipId(saved.id);
      setLinkedFromId(null);
      
      // Directly open print modal (no confirm() which causes focus event → re-render → modal disappears)
      onOpenPrint(saved);
    } catch (err: any) {
      alert(err.message || '전표 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    if (confirm('작성 중인 전표 내용을 초기화하시겠습니까?')) {
      setSlipDate(todayStr);
      setPaidAmount(0);
      setMemo('');
      setNeedDelivery(false);
      if (products.length > 0) {
        const p = products[0];
        setItems([
          {
            id: `row-${Date.now()}`,
            productId: p.id,
            productCode: p.code,
            productName: p.name,
            spec: p.spec,
            unit: p.unit,
            qty: 1,
            unitPrice: p.sellingPrice,
            supplyAmount: p.sellingPrice,
            taxAmount: Math.round(p.sellingPrice * 0.1),
            totalAmount: Math.round(p.sellingPrice * 1.1),
            memo: ''
          }
        ]);
      }
    }
  };

  // Filtered Slip History
  const filteredSlips = useMemo(() => {
    const result = slips.filter(s => {
      if (s.slipDate < historyStartDate || s.slipDate > historyEndDate) return false;
      
      if (!deferredHistoryFilter.trim()) return true;
      const q = deferredHistoryFilter.toLowerCase();
      return (
        s.slipNo.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        (s.siteName && s.siteName.toLowerCase().includes(q)) ||
        s.items.some(i => i.productName.toLowerCase().includes(q))
      );
    });
    // 최신순(전표일자 내림차순, 생성일시 내림차순) 정렬
    return result.sort((a, b) => b.slipDate.localeCompare(a.slipDate) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [slips, historyStartDate, historyEndDate, deferredHistoryFilter]);

  const { totalFilteredSupply, totalFilteredTax, totalFilteredAmount } = useMemo(() => {
    return filteredSlips.reduce((acc, slip) => {
      // 발주서나 납품서는 금액 합계에서 제외(숨김 처리되므로)
      if (slip.slipType === 'ORDER' || slip.slipType === 'DELIVERY') return acc;
      
      const slipSupply = slip.items.reduce((s, it) => s + (it.supplyAmount || 0), 0);
      const slipTax = slip.items.reduce((s, it) => s + (it.taxAmount || 0), 0);
      
      return {
        totalFilteredSupply: acc.totalFilteredSupply + slipSupply,
        totalFilteredTax: acc.totalFilteredTax + slipTax,
        totalFilteredAmount: acc.totalFilteredAmount + slip.totalAmount
      };
    }, { totalFilteredSupply: 0, totalFilteredTax: 0, totalFilteredAmount: 0 });
  }, [filteredSlips]);

  const formatKRW = (num: number) => num.toLocaleString('ko-KR') + '원';

  const handleOpenPrintPreview = () => {
    if (!selectedCustomerId) {
      showToast('명세서 출력을 위해 먼저 거래처를 선택해주세요.', 'error');
      return;
    }
    const currentCustomer = customers.find(c => c.id === selectedCustomerId);
    
    const previewSlip: Slip = {
      id: editingSlipId || 'PREVIEW',
      slipNo: editingSlipId ? (slips.find(s => s.id === editingSlipId)?.slipNo || 'PREVIEW') : 'PREVIEW',
      slipDate,
      slipType,
      customerId: selectedCustomerId,
      customerName: currentCustomer?.name || '',
      siteId: selectedSiteId,
      siteName: selectedSiteName,
      siteManager: selectedSiteManager,
      siteAddress: selectedSiteAddress,
      items,
      totalSupplyAmount,
      totalTaxAmount,
      totalAmount,
      paymentType,
      paidAmount,
      unpaidAmount,
      prevReceivables,
      memo,
      createdAt: editingSlipId ? (slips.find(s => s.id === editingSlipId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      digitalSignature: editingSlipId ? slips.find(s => s.id === editingSlipId)?.digitalSignature : undefined,
      tsaToken: editingSlipId ? slips.find(s => s.id === editingSlipId)?.tsaToken : undefined,
    };
    onOpenPrint(previewSlip);
  };

  const handleDownloadHistoryExcel = async () => {
    try {
      const xlsx = await import('xlsx');
      
      const exportData = filteredSlips.map((slip, idx) => {
        const supplyAmt = slip.items.reduce((s, it) => s + (it.supplyAmount || 0), 0);
        const taxAmt = slip.items.reduce((s, it) => s + (it.taxAmount || 0), 0);
        const hideAmounts = slip.slipType === 'DELIVERY' || slip.slipType === 'ORDER';

        return {
          'NO': filteredSlips.length - idx,
          '전표일자': slip.slipDate,
          '구분': slip.slipType === 'SALES' ? '매출' : slip.slipType === 'DELIVERY' ? '납품' : slip.slipType === 'ORDER' ? '발주' : slip.slipType === 'PURCHASE' ? '매입' : '반품',
          '거래처명': slip.customerName,
          '현장명': slip.siteName || '',
          '공급가액': hideAmounts ? 0 : supplyAmt,
          '세액': hideAmounts ? 0 : taxAmt,
          '합계': hideAmounts ? 0 : slip.totalAmount,
          '전표번호': slip.slipNo
        };
      });

      // 요약행 추가
      exportData.push({
        'NO': '총 합계' as any,
        '전표일자': '',
        '구분': '',
        '거래처명': '',
        '현장명': '',
        '공급가액': totalFilteredSupply,
        '세액': totalFilteredTax,
        '합계': totalFilteredAmount,
        '전표번호': ''
      });

      const worksheet = xlsx.utils.json_to_sheet(exportData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, '전표조회내역');
      
      xlsx.writeFile(workbook, `전표조회내역_${historyStartDate}_${historyEndDate}.xlsx`);
      showToast('✅ 검색된 전표 내역이 엑셀로 저장되었습니다.', 'success');
    } catch (e) {
      showToast('❌ 엑셀 저장 중 오류가 발생했습니다.', 'error');
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-140px)] min-h-[600px] overflow-hidden relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-[200] px-4 py-3 rounded shadow-xl text-sm font-bold flex items-center gap-2 max-w-md w-max transition-all duration-300 ease-out ${
          toastMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-2 border-emerald-500' :
          toastMessage.type === 'error' ? 'bg-red-50 text-red-800 border-2 border-red-500' :
          'bg-blue-50 text-blue-800 border-2 border-blue-500'
        }`}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* LEFT COLUMN: Slip History Table (Master) */}
      <div className={`w-full lg:w-[45%] flex flex-col rounded-lg border shadow-xs overflow-hidden ${osTheme === 'winxp-retro' ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col flex-1 min-h-0 p-4 pb-2">
        <div className="flex flex-col gap-1 mb-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-800">
                최근 발행 전표 내역 ({filteredSlips.length}건)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                발행된 매출/매입 전표 조회, 거래명세표 재인쇄 및 삭제 관리
              </p>
            </div>
            <button
              onClick={handleDownloadHistoryExcel}
              className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded text-[11px] font-bold flex items-center gap-1 shadow-sm transition-colors"
              title="현재 조회된 내역을 엑셀 파일로 다운로드합니다."
            >
              📊 엑셀 저장
            </button>
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600">조회일자</span>
              <input
                type="date"
                value={historyStartDate}
                onChange={e => setHistoryStartDate(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
              />
              <span>~</span>
              <input
                type="date"
                value={historyEndDate}
                onChange={e => setHistoryEndDate(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="전표번호, 거래처명, 현장명, 품목명 검색..."
                value={historyFilter}
                onChange={e => setHistoryFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
              />
            </div>
          </div>
        </div>

        {/* History Table View (Ledger View) */}
        <div className="flex-1 overflow-x-auto overflow-y-auto border-t border-slate-200">
          <table className="w-full text-left text-[11px] border-collapse font-sans whitespace-nowrap min-w-[600px]">
            <thead className="sticky top-0 bg-slate-100 text-slate-600 border-b border-slate-200 z-10">
              <tr>
                <th className="py-2 px-2 text-center w-10">NO</th>
                <th className="py-2 px-2 text-center w-20">전표일자</th>
                <th className="py-2 px-2 text-center w-12">구분</th>
                <th className="py-2 px-2 min-w-[120px]">거래처명</th>
                <th className="py-2 px-2 min-w-[120px]">현장명</th>
                <th className="py-2 px-2 text-right w-20">공급가액</th>
                <th className="py-2 px-2 text-right w-20">합계</th>
                <th className="py-2 px-2 text-right w-16">세액</th>
                <th className="py-2 px-2 text-center w-16">전표번호</th>
                <th className="py-2 px-2 text-center w-16">기능</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredSlips.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    해당 기간에 발행된 전표 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredSlips.map((slip, idx) => {
                  const isSales = slip.slipType === 'SALES';
                  const isPurchase = slip.slipType === 'PURCHASE';
                  const slipTypeLabel = 
                    slip.slipType === 'SALES' || isSales ? '매출' : 
                    slip.slipType === 'DELIVERY' ? '납품' : 
                    slip.slipType === 'ORDER' ? '발주' : 
                    isPurchase ? '매입' : '반품';
                  const slipTypeColor =
                    slip.slipType === 'SALES' || isSales ? 'text-blue-700 font-bold' :
                    slip.slipType === 'DELIVERY' ? 'text-emerald-700 font-bold' :
                    slip.slipType === 'ORDER' ? 'text-rose-700 font-bold' :
                    isPurchase ? 'text-emerald-700 font-bold' : 'text-slate-700';
                  
                  const supplyAmt = slip.items.reduce((s, it) => s + (it.supplyAmount || 0), 0);
                  const taxAmt = slip.items.reduce((s, it) => s + (it.taxAmount || 0), 0);
                  const hideAmounts = slip.slipType === 'DELIVERY' || slip.slipType === 'ORDER';

                  return (
                    <tr
                      key={slip.id}
                      onClick={() => handleLoadSlip(slip)}
                      className={`cursor-pointer transition-colors hover:bg-blue-50 ${
                        editingSlipId === slip.id ? 'bg-blue-100' : ''
                      }`}
                    >
                      <td className="py-1.5 px-2 text-center text-slate-400">{filteredSlips.length - idx}</td>
                      <td className="py-1.5 px-2 text-center font-mono text-slate-600">{slip.slipDate}</td>
                      <td className={`py-1.5 px-2 text-center ${slipTypeColor}`}>{slipTypeLabel}</td>
                      <td className="py-1.5 px-2 font-bold text-slate-800 truncate max-w-[150px]" title={slip.customerName}>{slip.customerName}</td>
                      <td className="py-1.5 px-2 text-slate-600 truncate max-w-[150px]" title={slip.siteName || ''}>{slip.siteName || '-'}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-semibold text-slate-700">
                        {hideAmounts ? '-' : supplyAmt.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-blue-700">
                        {hideAmounts ? '-' : slip.totalAmount.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                        {hideAmounts ? '-' : taxAmt.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono text-slate-500">#{slip.slipNo}</td>
                      <td className="py-1.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onOpenPrint(slip); }} 
                            className="p-1 text-blue-600 hover:bg-blue-200 rounded" 
                            title="명세서 인쇄"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteSlip(slip.id); }} 
                            className="p-1 text-rose-500 hover:bg-rose-100 rounded" 
                            title="전표 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredSlips.length > 0 && (
              <tfoot className="sticky bottom-0 bg-slate-50 border-t-2 border-slate-300 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] text-slate-800">
                <tr>
                  <td colSpan={5} className="py-2 px-2 text-center font-bold text-slate-700 border-r border-slate-200">
                    검색 내역 총 합계
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-800">
                    {totalFilteredSupply.toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-blue-700 text-sm">
                    {totalFilteredAmount.toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold text-slate-700">
                    {totalFilteredTax.toLocaleString('ko-KR')}
                  </td>
                  <td colSpan={2} className="py-2 px-2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        </div>
      </div>
      {/* RIGHT COLUMN: Entry Form (Detail) */}
      <div className={`w-full lg:w-[60%] flex flex-col rounded-lg border shadow-xs overflow-hidden ${osTheme === 'winxp-retro' ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Top Slip Config Card (Sticky Header) */}
      <div className={`p-4 rounded-lg border shadow-xs sticky top-0 z-10 backdrop-blur-md ${
        osTheme === 'winxp-retro'
          ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white/90 border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <h2 className="font-bold text-sm text-slate-800 flex items-center gap-2">
              <span>{editingSlipId ? '기존 전표 수정 (업데이트 모드)' : '신규 전표 작성'}</span>
              <span className="text-xs font-normal text-slate-500">
                (FarPoint Spread 3.0 초고속 키보드 최적화)
              </span>
            </h2>
          </div>

          <div className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-slate-600">명세서 구분 (8종):</span>
            <div className="flex flex-wrap rounded-md border border-slate-300 overflow-hidden bg-slate-100 w-full max-w-3xl">
              {[
                { type: 'SALES', label: '매출', icon: '💳', color: 'bg-blue-600' },
                { type: 'PURCHASE', label: '매입', icon: '🛒', color: 'bg-purple-600' },
                { type: 'RETURN_IN', label: '반입', icon: '↩️', color: 'bg-amber-600' },
                { type: 'RETURN_OUT', label: '반출', icon: '↪️', color: 'bg-orange-600' },
                { type: 'ESTIMATE', label: '견적', icon: '📊', color: 'bg-teal-600' },
                { type: 'ORDER', label: '발주', icon: '📝', color: 'bg-rose-600' },
                { type: 'DELIVERY', label: '납품', icon: '🚚', color: 'bg-emerald-600' },
                { type: 'CONTRACT', label: '수주', icon: '🤝', color: 'bg-cyan-600' }
              ].map(t => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => handleSlipTypeChange(t.type as SlipType)}
                  className={`flex-1 min-w-[70px] px-2 py-1.5 font-bold transition-colors text-[11px] whitespace-nowrap border-r border-slate-200 last:border-0 ${
                    slipType === t.type ? `${t.color} text-white shadow-inner` : 'text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bento Grid Layout for Form Fields */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-3">
          {/* Card 1: 기본 정보 (Basic Info) */}
          <div className="lg:col-span-2 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <h3 className="font-bold text-slate-700 text-xs flex items-center gap-1 border-b border-slate-200 pb-1.5">
              <span>기본 거래 정보</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">전표 일자</label>
                <input
                  type="date"
                  value={slipDate}
                  onChange={e => setSlipDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-800 font-mono focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">거래처 선택</label>
                  <div className="flex items-center gap-2">
                    {selectedCustomerId && (
                      <button
                        type="button"
                        onClick={() => { setSelectedCustomerId(''); setSelectedSiteId(''); }}
                        className="text-[11px] text-rose-500 hover:underline font-medium"
                      >
                        선택 취소
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigateTab('customers')}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      + 거래처
                    </button>
                  </div>
                </div>
                <div className="flex gap-1.5 mb-1.5">
                  <input
                    type="text"
                    placeholder="🔍 거래처 및 현장 통합검색..."
                    value={customerSearchFilter}
                    onChange={e => setCustomerSearchFilter(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 font-medium transition-colors"
                  />
                  {customerSearchFilter && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearchFilter('')}
                      className="px-2 py-1 text-xs text-slate-500 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 rounded font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={e => handleCustomerChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- 거래처를 선택하세요 --</option>
                  {filteredCustomersList.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code}) {c.sites && c.sites.length > 0 ? `[현장 ${c.sites.length}곳]` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {slipType === 'ORDER' ? (
              <div>
                <label className="block font-bold text-rose-600 mb-1 text-xs">발송(현장) 주소 [필수]</label>
                <textarea
                  placeholder="공장/제조사에서 발송할 목적지 주소를 반드시 입력하세요."
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  className="w-full px-2 py-1.5 border-2 border-rose-300 rounded bg-rose-50 text-xs h-12"
                />
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-xs">명세서 비고/메모</label>
                <input
                  type="text"
                  placeholder="간단한 메모 입력..."
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>
            )}
          </div>

          {/* Card 2: 결제 및 금액 (Payment Info) */}
          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg space-y-3">
            <h3 className="font-bold text-blue-900 text-xs flex items-center gap-1 border-b border-blue-200 pb-1.5">
              <span>결제 및 잔액 정보</span>
            </h3>
            <div className="text-xs space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">거래 전 외상미수금</label>
                <div className="px-2.5 py-1.5 border border-slate-200 rounded bg-white font-mono font-bold text-slate-700 text-right">
                  {formatKRW(prevReceivables)}
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">결제 방식</label>
                <select
                  value={paymentType}
                  onChange={e => setPaymentType(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-800 focus:ring-1 focus:ring-blue-500 mb-1.5"
                >
                  <option value="credit">외상 (미수누적)</option>
                  <option value="cash">현금 즉시결제</option>
                  <option value="card">카드 결제</option>
                  <option value="mixed">복합 결제</option>
                </select>
                {paymentType !== 'credit' && (
                  <input
                    type="number"
                    placeholder="입금액 입력"
                    value={paidAmount || ''}
                    onChange={e => setPaidAmount(Number(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-right font-mono text-blue-700 font-bold"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Progressive Disclosure: Site & Delivery (Accordion) */}
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mb-2">
          <button
            type="button"
            onClick={() => setIsOptionsExpanded(!isOptionsExpanded)}
            className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700"
          >
            <div className="flex items-center gap-2">
              <Truck className={`w-4 h-4 ${needDelivery || selectedSiteId ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>공사현장 지정 및 출고/배송 오더 (선택)</span>
              {(selectedSiteId || needDelivery) && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">설정됨</span>
              )}
            </div>
            <span className="text-slate-400 font-mono text-[10px]">
              {isOptionsExpanded ? '▲ 접기' : '▼ 펼치기'}
            </span>
          </button>
          
          {isOptionsExpanded && (
            <div className="p-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50/50">
              {/* Site Selection */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-blue-900 flex items-center gap-1 text-xs">
                    <HardHat className="w-3.5 h-3.5 text-blue-600" />
                    <span>공사현장 (Site)</span>
                    {currentCustomer?.sites && currentCustomer.sites.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-200 text-blue-900 text-[10px] font-bold">
                        {currentCustomer.sites.length}
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickSiteModalOpen(true)}
                    className="text-[10px] font-bold text-blue-700 bg-white hover:bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded shadow-2xs"
                  >
                    + 새 현장
                  </button>
                </div>
                <div className="flex gap-1.5 mb-1.5">
                  <input
                    type="text"
                    placeholder="🔍 현장명/소장 검색..."
                    value={siteSearchFilter}
                    onChange={e => setSiteSearchFilter(e.target.value)}
                    className="w-full px-2 py-1 border border-blue-200 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500"
                  />
                  {siteSearchFilter && (
                    <button
                      type="button"
                      onClick={() => setSiteSearchFilter('')}
                      className="px-2 py-1 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 rounded"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <select
                  value={selectedSiteId}
                  onChange={e => handleSiteSelect(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-blue-300 rounded bg-white text-blue-950 font-semibold focus:ring-1 focus:ring-blue-500 text-xs"
                >
                  <option value="">[본사 / 현장지정 없음]</option>
                  {filteredSitesList.map(st => (
                    <option key={st.id || st.siteCode} value={st.id || st.siteCode}>
                      {st.siteName} {st.manager ? `(${st.manager})` : ''}
                    </option>
                  ))}
                </select>
                {selectedSiteId && (
                  <div className="text-[11px] text-slate-500 bg-white p-2 border border-slate-200 rounded">
                    <div><strong>주소:</strong> {selectedSiteAddress || '-'}</div>
                    <div><strong>소장:</strong> {selectedSiteManager || '-'}</div>
                  </div>
                )}
              </div>

              {/* Delivery Toggle & Options */}
              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={needDelivery}
                    onChange={e => setNeedDelivery(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-slate-800 text-xs">
                    배송 / 출고 오더 생성
                  </span>
                </label>

                {needDelivery && (
                  <div className="space-y-2 text-xs bg-white p-2.5 border border-slate-200 rounded">
                    <div>
                      <label className="block text-slate-500 mb-0.5">배송지 주소</label>
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={e => setDeliveryAddress(e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-500 mb-0.5">연락처</label>
                        <input
                          type="text"
                          value={deliveryTel}
                          onChange={e => setDeliveryTel(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-500 mb-0.5">배송기사명</label>
                        <input
                          type="text"
                          value={driverName}
                          onChange={e => setDriverName(e.target.value)}
                          className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* FarPoint Spread Grid Component */}
      <div className={`rounded-lg border shadow-xs overflow-hidden ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-xs text-slate-800">
              전표 상세 품목 그리드 (품목선택 &middot; 수량 &middot; 단가 자동연산)
            </span>
            <span className="text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
              {items.length}개 품목
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleAddRow}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" /> 행 추가 (Ins)
            </button>
          </div>
        </div>

        {/* Table Container - SaaS Style Spacious Grid */}
        <div className="overflow-x-auto" role="region" aria-label="전표 상세 품목 그리드">
          <table className="w-full text-left text-xs border-collapse font-sans" role="grid" aria-rowcount={items.length}>
            <thead role="rowgroup">
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 select-none whitespace-nowrap">
                <th className="py-3 px-3 w-10 text-center">NO</th>
                <th className="py-3 px-3 min-w-[200px]">품목 선택 / 검색</th>
                <th className="py-3 px-3 min-w-[140px]">규격 (Spec)</th>
                <th className="py-3 px-3 min-w-[70px] text-center">단위</th>
                <th className="py-3 px-3 min-w-[90px] text-right">수량</th>
                {slipType !== 'DELIVERY' && (
                  <>
                    <th className="py-3 px-3 min-w-[110px] text-right">단가</th>
                    <th className="py-3 px-3 min-w-[120px] text-right">공급가액</th>
                    <th className="py-3 px-3 min-w-[100px] text-right">세액(10%)</th>
                    <th className="py-3 px-3 min-w-[130px] text-right">합계금액</th>
                  </>
                )}
                <th className="py-3 px-3 min-w-[140px]">품목비고</th>
                <th className="py-3 px-3 min-w-[60px] text-center">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white" role="rowgroup">
              {items.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  role="row"
                  aria-rowindex={idx + 1}
                  className="hover:bg-blue-50/30 transition-colors focus-within:bg-blue-50/50 whitespace-nowrap"
                >
                  <td className="py-3 px-3 text-center text-slate-400 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRowIndex(idx);
                        setProductSearchKeyword('');
                        setIsProductSearchOpen(true);
                      }}
                      className="w-full text-left py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-400 rounded-md font-medium text-slate-800 text-sm flex items-center justify-between group transition-all shadow-sm"
                      title="클릭하여 11,000+개 품목 중 빠른 검색 및 선택"
                    >
                      <div className="truncate flex-1 mr-1">
                        {row.productName ? (
                          <span className="font-bold text-slate-800">
                            {row.productName}{' '}
                            <span className="text-slate-500 font-normal text-xs">[{row.spec}]</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic flex items-center gap-1">
                            <Search className="w-4 h-4 text-slate-400" />
                            품목 검색 / 선택 (클릭)
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-1 bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-600 font-bold text-[10px] rounded transition-colors shrink-0">
                        🔍 검색 (F2)
                      </span>
                    </button>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-mono text-[11px] truncate max-w-[140px]">
                    {row.spec}
                  </td>
                  <td className="py-3 px-3 text-center text-slate-500 font-mono">
                    {row.unit}
                  </td>
                  <td className="py-3 px-3">
                    <input
                      type="number"
                      min={1}
                      value={row.qty}
                      onChange={e => handleItemChange(idx, 'qty', e.target.value)}
                      className="w-full py-2 px-2 border border-slate-200 rounded-md text-right font-mono font-bold text-slate-800 focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  {slipType !== 'DELIVERY' && (
                    <>
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          value={row.unitPrice}
                          onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)}
                          className="w-full py-2 px-2 border border-slate-200 rounded-md text-right font-mono text-slate-800 focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {row.supplyAmount.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        {row.taxAmount.toLocaleString('ko-KR')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-blue-600 text-sm">
                        {row.totalAmount.toLocaleString('ko-KR')}
                      </td>
                    </>
                  )}
                  <td className="py-3 px-3">
                    <input
                      type="text"
                      placeholder="비고"
                      value={row.memo || ''}
                      onChange={e => handleItemChange(idx, 'memo', e.target.value)}
                      className="w-full py-2 px-2 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="행 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Transaction Summary Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {slipType !== 'DELIVERY' ? (
              <>
                <div>
                  <span className="text-slate-500">공급가액: </span>
                  <strong className="font-mono text-slate-800 text-sm">
                    {totalSupplyAmount.toLocaleString('ko-KR')}원
                  </strong>
                </div>
                <div className="w-px h-3 bg-slate-300" />
                <div>
                  <span className="text-slate-500">부가세: </span>
                  <strong className="font-mono text-slate-800 text-sm">
                    {totalTaxAmount.toLocaleString('ko-KR')}원
                  </strong>
                </div>
                <div className="w-px h-3 bg-slate-300" />
                <div>
                  <span className="text-slate-500">전표 총액: </span>
                  <strong className="font-mono text-blue-700 text-base font-black">
                    {totalAmount.toLocaleString('ko-KR')}원
                  </strong>
                </div>
                <div className="w-px h-3 bg-slate-300" />
                <div className="bg-amber-50 border border-amber-200 px-2.5 py-1 rounded text-amber-900 font-medium">
                  거래 후 예상 미수잔액: <strong className="font-mono">{formatKRW(nextReceivables)}</strong>
                </div>
              </>
            ) : (
              <div className="text-emerald-700 font-bold bg-emerald-50 px-3 py-1.5 border border-emerald-200 rounded">
                ※ 납품명세서는 단가 및 금액이 노출되지 않습니다. (오직 수량만 기재)
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row w-full items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={(e) => handleExternalDispatch(e, 'FAX')}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
              >
                📠 팩스
              </button>
              <button
                type="button"
                onClick={(e) => handleExternalDispatch(e, 'KAKAO')}
                className="px-3 py-1.5 rounded bg-[#FEE500] hover:bg-[#F4DC00] text-black font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
              >
                💬 카톡
              </button>
              <button
                type="button"
                onClick={(e) => handleExternalDispatch(e, 'EMAIL')}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
              >
                ✉️ 이메일
              </button>
              <div className="w-px h-5 bg-slate-300 mx-1 hidden sm:block"></div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenPrintPreview();
                }}
                className="px-3 py-1.5 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
              >
                📄 PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="px-3 py-1.5 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center gap-1 shadow-sm transition-colors"
              >
                📊 엑셀
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleOpenPrintPreview();
                }}
                className="px-3 py-1.5 text-xs font-bold rounded border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>명세서 출력</span>
              </button>
              <button
                type="button"
                onClick={handleResetForm}
                className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>취소</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitSlip}
                className="px-5 py-1.5 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isSubmitting 
                    ? '저장 중...' 
                    : (editingSlipId ? '데이터 업데이트 저장 (F4)' : '신규 전표 저장 (F4)')
                  }
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

        </div>
      </div>

      {/* Quick Add Site Modal (from Slip Entry) */}
      {isQuickSiteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-md w-full p-4 text-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <HardHat className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  [{currentCustomer?.name || '거래처'}] 신규 공사현장 등록
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickSiteModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 space-y-2.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  공사현장명 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="예: 김포데이터센터 신축, 춘천레고랜드"
                  value={quickSiteInput.siteName}
                  onChange={e => setQuickSiteInput({ ...quickSiteInput, siteName: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs font-bold"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">현장 소장 / 담당자</label>
                  <input
                    type="text"
                    placeholder="예: 김소장"
                    value={quickSiteInput.manager}
                    onChange={e => setQuickSiteInput({ ...quickSiteInput, manager: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">현장 전화 / 모바일</label>
                  <input
                    type="text"
                    placeholder="010-0000-0000"
                    value={quickSiteInput.tel}
                    onChange={e => setQuickSiteInput({ ...quickSiteInput, tel: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">현장 납품지 주소</label>
                <input
                  type="text"
                  placeholder="직송 화물 기사에게 전달될 실제 현장 주소"
                  value={quickSiteInput.address}
                  onChange={e => setQuickSiteInput({ ...quickSiteInput, address: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">현장 특이사항 / 비고</label>
                <input
                  type="text"
                  placeholder="도착 전 소장님께 전화 필수 등"
                  value={quickSiteInput.memo}
                  onChange={e => setQuickSiteInput({ ...quickSiteInput, memo: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsQuickSiteModalOpen(false)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleQuickAddSite}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>등록 및 전표에 지정</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fast Product Search & Select Modal (Optimized for 11,000+ Products) */}
      {isProductSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-bold text-sm">
                    품목 빠른 검색 및 전표 반영
                  </h3>
                  <p className="text-[11px] text-blue-100">
                    전체 {products.length.toLocaleString()}개 품목 데이터베이스 실시간 연동
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProductSearchOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Filter Bar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="품목명, 규격, 코드(예: PRD-0001, 앙카, 볼트, 너트)..."
                  value={productSearchKeyword}
                  onChange={e => setProductSearchKeyword(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setIsProductSearchOpen(false);
                    if (e.key === 'Enter' && searchResults.length > 0) {
                      handleItemChange(activeRowIndex !== null ? activeRowIndex : 0, 'productId', searchResults[0].id);
                      setIsProductSearchOpen(false);
                    }
                  }}
                  className="w-full pl-9 pr-8 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                {productSearchKeyword && (
                  <button
                    type="button"
                    onClick={() => setProductSearchKeyword('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700 font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-mono px-2 py-1 bg-white border border-slate-200 rounded shrink-0">
                {searchResults.length}건
              </span>
            </div>

            {/* Results Table */}
            <div className="flex-1 overflow-y-auto p-2">
              <table className="w-full text-left text-xs border-collapse font-sans">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-2 px-2.5 w-20">코드</th>
                    <th className="py-2 px-2.5">품목명</th>
                    <th className="py-2 px-2.5">규격 (Spec)</th>
                    <th className="py-2 px-2 text-center w-14">단위</th>
                    <th className="py-2 px-2.5 text-right w-24">재고</th>
                    <th className="py-2 px-2.5 text-right w-28">출고단가</th>
                    <th className="py-2 px-2.5 text-center w-20">선택</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {searchResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        &quot;{productSearchKeyword}&quot;에 일치하는 품목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    searchResults.map(p => (
                      <tr
                        key={p.id}
                        onClick={() => {
                          if (activeRowIndex !== null) {
                            handleItemChange(activeRowIndex, 'productId', p.id);
                          }
                          setIsProductSearchOpen(false);
                        }}
                        className="hover:bg-blue-50 cursor-pointer transition-colors group"
                      >
                        <td className="py-2 px-2.5 font-mono text-slate-500 font-semibold">{p.code}</td>
                        <td className="py-2 px-2.5 font-bold text-slate-900 group-hover:text-blue-700">{p.name}</td>
                        <td className="py-2 px-2.5 text-slate-600 font-mono text-[11px]">{p.spec}</td>
                        <td className="py-2 px-2 text-center text-slate-500">{p.unit}</td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-700">
                          {p.currentStock.toLocaleString()}{p.unit}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-blue-700">
                          {p.sellingPrice.toLocaleString()}원
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              if (activeRowIndex !== null) {
                                handleItemChange(activeRowIndex, 'productId', p.id);
                              }
                              setIsProductSearchOpen(false);
                            }}
                            className="px-2.5 py-1 bg-blue-600 group-hover:bg-blue-700 text-white rounded font-bold text-[11px] shadow-2xs"
                          >
                            선택
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <span>
                💡 Enter 키를 누르면 첫 번째 검색 품목이 즉시 선택됩니다. (ESC로 닫기)
              </span>
              <button
                type="button"
                onClick={() => setIsProductSearchOpen(false)}
                className="px-4 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 font-semibold text-slate-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {dispatchModal.isOpen && dispatchModal.channel && (
        <div className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-5 border border-slate-200">
            <h3 className="font-bold text-lg mb-4 text-slate-800 border-b pb-2">
              {dispatchModal.channel === 'EMAIL' ? '✉️ 이메일 전송' : 
               dispatchModal.channel === 'KAKAO' ? '💬 카카오톡 전송' : '📠 팩스 전송'}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                {dispatchModal.channel === 'EMAIL' ? '받는 사람 이메일' : '받는 사람 연락처'}
              </label>
              <input
                type={dispatchModal.channel === 'EMAIL' ? 'email' : 'text'}
                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500"
                value={dispatchModal.contact}
                onChange={(e) => setDispatchModal(prev => ({ ...prev, contact: e.target.value }))}
                placeholder={dispatchModal.channel === 'EMAIL' ? 'example@email.com' : '010-0000-0000'}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmExternalDispatch();
                }}
              />
              <p className="text-xs text-slate-500 mt-2">
                실제 전송 테스트를 원하시면 본인의 연락처/이메일을 입력 후 발송해보세요.
              </p>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDispatchModal({ isOpen: false, channel: null, contact: '' })}
                className="px-4 py-2 border border-slate-300 rounded text-slate-700 font-medium text-sm hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmExternalDispatch}
                className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700 shadow-sm"
              >
                발송하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
