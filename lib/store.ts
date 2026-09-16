import fs from 'fs';
import path from 'path';
import type {
  Product,
  Customer,
  Slip,
  DeliveryOrder,
  InventoryLog,
  SystemConfig,
  SlipItem,
  Bill,
  TaxInvoice,
  CollectionPayment,
  CustomerPriceItem
} from '@/types';

export interface DatabaseState {
  products: Product[];
  customers: Customer[];
  slips: Slip[];
  deliveries: DeliveryOrder[];
  inventoryLogs: InventoryLog[];
  bills: Bill[];
  taxInvoices: TaxInvoice[];
  collections: CollectionPayment[];
  config: SystemConfig;
}

const DB_FILE_PATH = path.join(process.cwd(), 'data', 'db.json');
const PRICES_FILE_PATH = path.join(process.cwd(), 'data', 'prices.json');

export function loadCustomerPrices(): Record<string, Record<string, CustomerPriceItem>> {
  try {
    if (fs.existsSync(PRICES_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(PRICES_FILE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load prices.json:', e);
  }
  return {};
}

const INITIAL_CONFIG: SystemConfig = {
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
    name: '동산화스너',
    bizNumber: '120-81-45678',
    ceo: '홍길동',
    address: '서울특별시 금천구 가산디지털1로 145 에이스하이엔드타워 3차 502호',
    tel: '02-850-7000',
    bizType: '제조 및 도소매',
    bizItem: '볼트, 너트, 화스너 및 철물 일체'
  }
};

const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p-1',
    code: 'B-HEX-1035',
    name: '육각볼트 (Hex Bolt)',
    spec: 'M10 x 35 (아연도금)',
    unit: 'BOX(500)',
    costPrice: 28000,
    sellingPrice: 38000,
    currentStock: 145,
    safeStock: 30,
    category: '볼트',
    barcode: '880100100101',
    supplier: '성화내진전착볼트(주)',
    memo: '설비 배관용 표준 볼트'
  },
  {
    id: 'p-2',
    code: 'B-HEX-1250',
    name: '육각볼트 (Hex Bolt)',
    spec: 'M12 x 50 (용융아연)',
    unit: 'BOX(300)',
    costPrice: 32000,
    sellingPrice: 44000,
    currentStock: 82,
    safeStock: 25,
    category: '볼트',
    barcode: '880100100102',
    supplier: '성화내진전착볼트(주)',
    memo: '고강도 구조물 체결용'
  },
  {
    id: 'p-3',
    code: 'B-F10T-1670',
    name: '고장력볼트 (F10T)',
    spec: 'M16 x 70 (흑색)',
    unit: 'SET(100)',
    costPrice: 45000,
    sellingPrice: 62000,
    currentStock: 18,
    safeStock: 20,
    category: '볼트',
    barcode: '880100100103',
    supplier: '성화내진전착볼트(주)',
    memo: '철골 플랜트 결합용'
  },
  {
    id: 'p-4',
    code: 'N-HEX-10',
    name: '육각너트 (Hex Nut)',
    spec: 'M10 (삼가크롬)',
    unit: 'BOX(1000)',
    costPrice: 19000,
    sellingPrice: 27000,
    currentStock: 210,
    safeStock: 40,
    category: '너트',
    barcode: '880100200101',
    supplier: '성화시스템찬넬(주)'
  },
  {
    id: 'p-5',
    code: 'N-HEX-12',
    name: '육각너트 (Hex Nut)',
    spec: 'M12 (용융아연)',
    unit: 'BOX(800)',
    costPrice: 24000,
    sellingPrice: 33000,
    currentStock: 160,
    safeStock: 30,
    category: '너트',
    barcode: '880100200102',
    supplier: '성화시스템찬넬(주)'
  },
  {
    id: 'p-6',
    code: 'W-FLAT-10',
    name: '평와셔 (Flat Washer)',
    spec: 'M10 (두께 2.0t)',
    unit: '봉지(1000)',
    costPrice: 12000,
    sellingPrice: 18000,
    currentStock: 95,
    safeStock: 20,
    category: '와셔',
    barcode: '880100300101'
  },
  {
    id: 'p-7',
    code: 'W-SPG-10',
    name: '스프링와셔 (Spring Washer)',
    spec: 'M10 (아연)',
    unit: '봉지(1000)',
    costPrice: 14000,
    sellingPrice: 20000,
    currentStock: 110,
    safeStock: 20,
    category: '와셔',
    barcode: '880100300102'
  },
  {
    id: 'p-8',
    code: 'A-SET-38',
    name: '세트앙카 (Set Anchor)',
    spec: '3/8 x 3" (전기아연)',
    unit: 'BOX(200)',
    costPrice: 21000,
    sellingPrice: 30000,
    currentStock: 64,
    safeStock: 15,
    category: '앙카',
    barcode: '880100400101',
    memo: '콘크리트 매립 배관 고정'
  },
  {
    id: 'p-9',
    code: 'A-WDG-12',
    name: '웨지앙카 (Wedge Anchor)',
    spec: 'M12 x 100 (내진인증)',
    unit: 'BOX(100)',
    costPrice: 36000,
    sellingPrice: 51000,
    currentStock: 48,
    safeStock: 15,
    category: '앙카',
    barcode: '880100400102'
  },
  {
    id: 'p-10',
    code: 'S-CH-3000',
    name: '찬넬 (C-Channel)',
    spec: '41 x 41 x 2.0t x 3M',
    unit: '본(개)',
    costPrice: 16000,
    sellingPrice: 23000,
    currentStock: 120,
    safeStock: 20,
    category: '찬넬/서포트',
    supplier: '성화써포트(주)'
  }
];

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'c-1',
    code: 'C00101',
    name: '(주)미동이엔씨',
    bizNumber: '214-85-12345',
    ceo: '김미동',
    tel: '02-6925-1100',
    fax: '02-6925-1109',
    mobile: '010-3344-5566',
    address: '서울특별시 구로구 디지털로33길 11 에이스테크노타워 8차 701호',
    bizType: '건설/전기공사',
    bizItem: '소방설비, 플랜트 배관자재',
    receivables: 4850000,
    closingDay: 25,
    email: 'midong@midongenc.com',
    memo: '월말 25일 정기결제업체 (우수거래처)'
  },
  {
    id: 'c-2',
    code: 'C00102',
    name: '메가일렉(주)',
    bizNumber: '119-86-98765',
    ceo: '박메가',
    tel: '031-499-8800',
    fax: '031-499-8809',
    mobile: '010-9988-7766',
    address: '경기도 시흥시 엠티브이북로 123',
    bizType: '제조 및 배전반',
    bizItem: '배전반 프레임 체결 볼트/너트',
    receivables: 2340000,
    closingDay: 30,
    email: 'megaelec@mega.co.kr'
  },
  {
    id: 'c-3',
    code: 'C00103',
    name: '성화내진전착볼트(주)',
    bizNumber: '135-81-24680',
    ceo: '이성화',
    tel: '031-355-4000',
    address: '경기도 화성시 양감면 초록로 200',
    bizType: '제조업',
    bizItem: '내진전착볼트 및 찬넬 부속',
    receivables: 0,
    payables: 6500000,
    memo: '주요 매입 거래처'
  },
  {
    id: 'c-4',
    code: 'C00104',
    name: '성화시스템찬넬(주)',
    bizNumber: '135-86-13579',
    ceo: '최찬넬',
    tel: '031-355-4010',
    address: '경기도 화성시 향남읍 발안로 150',
    bizType: '제조업',
    bizItem: 'C형찬넬, 타공찬넬, 서포트',
    receivables: 0,
    payables: 3800000,
    memo: '찬넬 직거래 공장'
  },
  {
    id: 'c-5',
    code: 'C00105',
    name: '종합전기(주)',
    bizNumber: '107-82-34567',
    ceo: '정종합',
    tel: '02-2275-5544',
    address: '서울특별시 중구 청계천로 154',
    bizType: '도소매',
    bizItem: '전기통신공사 잡자재',
    receivables: 1150000,
    closingDay: 20
  }
];

const INITIAL_SLIPS: Slip[] = [
  {
    id: 's-1',
    slipNo: 'S20260316-0001',
    slipDate: '2026-03-16',
    slipType: 'sales',
    customerId: 'c-1',
    customerName: '(주)미동이엔씨',
    items: [
      {
        id: 'si-1',
        productId: 'p-1',
        productCode: 'B-HEX-1035',
        productName: '육각볼트 (Hex Bolt)',
        spec: 'M10 x 35 (아연도금)',
        unit: 'BOX(500)',
        qty: 5,
        unitPrice: 38000,
        supplyAmount: 190000,
        taxAmount: 19000,
        totalAmount: 209000
      },
      {
        id: 'si-2',
        productId: 'p-4',
        productCode: 'N-HEX-10',
        productName: '육각너트 (Hex Nut)',
        spec: 'M10 (삼가크롬)',
        unit: 'BOX(1000)',
        qty: 5,
        unitPrice: 27000,
        supplyAmount: 135000,
        taxAmount: 13500,
        totalAmount: 148500
      }
    ],
    totalSupplyAmount: 325000,
    totalTaxAmount: 32500,
    totalAmount: 357500,
    paymentType: 'credit',
    paidAmount: 0,
    unpaidAmount: 357500,
    prevReceivables: 4492500,
    memo: '구로 현장 납품 (지게차 하차 요청)',
    createdAt: new Date().toISOString(),
    deliveryStatus: 'shipping'
  }
];

const INITIAL_DELIVERIES: DeliveryOrder[] = [
  {
    id: 'd-1',
    slipId: 's-1',
    slipNo: 'S20260316-0001',
    customerName: '(주)미동이엔씨',
    address: '서울특별시 구로구 디지털로33길 11 현장 창고 1층',
    tel: '010-3344-5566',
    driverName: '이배송 기사',
    driverTel: '010-5555-7777',
    status: 'delivering',
    requestedDate: '2026-03-16',
    itemsSummary: '육각볼트(5BOX), 육각너트(5BOX)',
    memo: '도착 10분 전 현장소장님 연락 요망'
  }
];

const INITIAL_INVENTORY_LOGS: InventoryLog[] = [
  {
    id: 'log-1',
    date: '2026-03-16',
    productId: 'p-1',
    productName: '육각볼트 (Hex Bolt)',
    spec: 'M10 x 35 (아연도금)',
    changeType: 'out',
    changeQty: 5,
    beforeQty: 150,
    afterQty: 145,
    slipNo: 'S20260316-0001',
    reason: '매출 전표 출고: (주)미동이엔씨',
    createdAt: new Date().toISOString()
  },
  {
    id: 'log-2',
    date: '2026-03-16',
    productId: 'p-4',
    productName: '육각너트 (Hex Nut)',
    spec: 'M10 (삼가크롬)',
    changeType: 'out',
    changeQty: 5,
    beforeQty: 215,
    afterQty: 210,
    slipNo: 'S20260316-0001',
    reason: '매출 전표 출고: (주)미동이엔씨',
    createdAt: new Date().toISOString()
  }
];

// Memory Singleton State
let globalStore: DatabaseState | null = null;

export function loadStore(): DatabaseState {
  if (globalStore) return globalStore;

  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const fileData = fs.readFileSync(DB_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(fileData);
      globalStore = {
        products: parsed.products || [],
        customers: parsed.customers || [],
        slips: parsed.slips || [],
        deliveries: parsed.deliveries || [],
        inventoryLogs: parsed.inventoryLogs || [],
        bills: parsed.bills || [],
        taxInvoices: parsed.taxInvoices || [],
        collections: parsed.collections || [],
        config: parsed.config || INITIAL_CONFIG
      };
      return globalStore;
    }
  } catch (err) {
    console.warn('Failed to read db.json, using initial state:', err);
  }

  globalStore = {
    products: INITIAL_PRODUCTS,
    customers: INITIAL_CUSTOMERS,
    slips: INITIAL_SLIPS,
    deliveries: INITIAL_DELIVERIES,
    inventoryLogs: INITIAL_INVENTORY_LOGS,
    bills: [],
    taxInvoices: [],
    collections: [],
    config: INITIAL_CONFIG
  };

  saveStore(globalStore);
  return globalStore;
}

// Real-time Event Subscription for Live Multi-Device Sync (SSE)
export type StoreChangeEvent = {
  type: string;
  timestamp: number;
};
type ChangeListener = (event: StoreChangeEvent) => void;
const changeListeners = new Set<ChangeListener>();

export function subscribeStoreChanges(listener: ChangeListener) {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

export function notifyStoreChange(type = 'mutation') {
  const event: StoreChangeEvent = { type, timestamp: Date.now() };
  for (const listener of changeListeners) {
    try {
      listener(event);
    } catch (err) {
      console.warn('Listener error in notifyStoreChange:', err);
    }
  }
}

export function saveStore(state: DatabaseState) {
  try {
    const dir = path.dirname(DB_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    globalStore = state;
    // Realtime notification to all connected internet devices
    notifyStoreChange('mutation');
  } catch (err) {
    console.error('Failed to save db.json:', err);
  }
}

export function resetDemoStore(): DatabaseState {
  const freshState: DatabaseState = {
    products: INITIAL_PRODUCTS,
    customers: INITIAL_CUSTOMERS,
    slips: INITIAL_SLIPS,
    deliveries: INITIAL_DELIVERIES,
    inventoryLogs: INITIAL_INVENTORY_LOGS,
    bills: [],
    taxInvoices: [],
    collections: [],
    config: INITIAL_CONFIG
  };
  saveStore(freshState);
  return freshState;
}

// Transaction: Collection / Payment (수금 및 지급 등록)
export function addCollectionTransaction(data: {
  date: string;
  type: 'collection' | 'payment';
  customerId: string;
  method: 'cash' | 'bank' | 'bill';
  amount: number;
  memo?: string;
}): CollectionPayment {
  const store = loadStore();
  const cust = store.customers.find(c => c.id === data.customerId || c.code === data.customerId);
  const cName = cust ? cust.name : '미지정 거래처';
  const prevBalance = cust ? (cust.receivables || 0) : 0;
  
  // 수금 시 미수금 차감, 지급 시 미수금 가산(또는 외상매입금 차감)
  let currentBalance = prevBalance;
  if (cust) {
    if (data.type === 'collection') {
      currentBalance = Math.max(0, prevBalance - data.amount);
      cust.receivables = currentBalance;
    } else {
      currentBalance = prevBalance + data.amount;
      cust.receivables = currentBalance;
    }
  }

  const record: CollectionPayment = {
    id: `cp-${Date.now()}`,
    date: data.date || new Date().toISOString().slice(0, 10),
    type: data.type,
    customerId: data.customerId,
    customerName: cName,
    method: data.method,
    amount: data.amount,
    prevBalance,
    currentBalance,
    memo: data.memo || ''
  };

  store.collections.unshift(record);
  saveStore(store);
  return record;
}

// Transaction: Save Slip
export function saveSlipTransaction(slipData: Partial<Slip>, deliveryInfo?: any): Slip {
  const store = loadStore();
  const slipId = slipData.id || `s-${Date.now()}`;
  const now = new Date();
  const dateStr = slipData.slipDate || now.toISOString().slice(0, 10);
  const slipNo = slipData.slipNo || `S${dateStr.replace(/-/g, '')}-${String(store.slips.length + 1).padStart(4, '0')}`;

  const customer = store.customers.find(c => c.id === slipData.customerId);
  const customerName = slipData.customerName || customer?.name || '미지정 거래처';
  const prevReceivables = customer?.receivables || 0;

  const items: SlipItem[] = (slipData.items || []).map((item, idx) => {
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const supplyAmount = Math.round(qty * unitPrice);
    const taxAmount = Math.round(supplyAmount * 0.1);
    const totalAmount = supplyAmount + taxAmount;
    return {
      ...item,
      id: item.id || `si-${Date.now()}-${idx}`,
      qty,
      unitPrice,
      supplyAmount,
      taxAmount,
      totalAmount
    };
  });

  const totalSupplyAmount = items.reduce((s, it) => s + it.supplyAmount, 0);
  const totalTaxAmount = items.reduce((s, it) => s + it.taxAmount, 0);
  const totalAmount = totalSupplyAmount + totalTaxAmount;
  const paidAmount = Number(slipData.paidAmount) || 0;
  const unpaidAmount = Math.max(0, totalAmount - paidAmount);

  const newSlip: Slip = {
    id: slipId,
    slipNo,
    slipDate: dateStr,
    slipType: slipData.slipType || 'sales',
    customerId: slipData.customerId || '',
    customerName,
    siteId: slipData.siteId,
    siteName: slipData.siteName,
    siteManager: slipData.siteManager,
    siteAddress: slipData.siteAddress,
    items,
    totalSupplyAmount,
    totalTaxAmount,
    totalAmount,
    paymentType: slipData.paymentType || (unpaidAmount > 0 ? 'credit' : 'cash'),
    paidAmount,
    unpaidAmount,
    prevReceivables,
    memo: slipData.memo || '',
    createdAt: now.toISOString(),
    deliveryStatus: deliveryInfo ? 'pending' : 'none'
  };

  // Stock deduction & Ledger log
  items.forEach(item => {
    const prod = store.products.find(p => p.id === item.productId || p.code === item.productCode);
    if (prod) {
      const beforeQty = prod.currentStock;
      let afterQty = beforeQty;
      let changeType: InventoryLog['changeType'] = 'out';

      if (newSlip.slipType === 'sales') {
        afterQty = beforeQty - item.qty;
        changeType = 'out';
      } else if (newSlip.slipType === 'purchase') {
        afterQty = beforeQty + item.qty;
        changeType = 'in';
      } else if (newSlip.slipType === 'return_sales') {
        afterQty = beforeQty + item.qty;
        changeType = 'return';
      } else if (newSlip.slipType === 'return_purchase') {
        afterQty = beforeQty - item.qty;
        changeType = 'out';
      }

      prod.currentStock = afterQty;

      store.inventoryLogs.unshift({
        id: `log-${Date.now()}-${item.id}`,
        date: dateStr,
        productId: prod.id,
        productName: prod.name,
        spec: prod.spec,
        changeType,
        changeQty: item.qty,
        beforeQty,
        afterQty,
        slipNo: newSlip.slipNo,
        reason: `${newSlip.slipType === 'sales' ? '매출' : '매입'} 전표 처리: ${customerName}`,
        createdAt: now.toISOString()
      });
    }
  });

  // Customer Receivables update
  if (customer && newSlip.slipType === 'sales') {
    customer.receivables = (customer.receivables || 0) + unpaidAmount;
  }

  // Delivery order creation if requested
  if (deliveryInfo && deliveryInfo.required) {
    const itemsSummary = items.map(i => `${i.productName}(${i.qty}${i.unit})`).join(', ');
    store.deliveries.unshift({
      id: `d-${Date.now()}`,
      slipId: newSlip.id,
      slipNo: newSlip.slipNo,
      customerName,
      siteId: deliveryInfo.siteId || slipData.siteId,
      siteName: deliveryInfo.siteName || slipData.siteName,
      address: deliveryInfo.address || customer?.address || '배송지 미지정',
      tel: deliveryInfo.tel || customer?.tel || '',
      driverName: deliveryInfo.driverName || '미배차',
      driverTel: deliveryInfo.driverTel || '',
      status: 'pending',
      requestedDate: deliveryInfo.requestedDate || dateStr,
      itemsSummary,
      memo: deliveryInfo.memo || newSlip.memo || ''
    });
  }

  store.slips.unshift(newSlip);
  saveStore(store);
  return newSlip;
}

// Transaction: Adjust Stock
export function adjustStockTransaction(productId: string, adjustQty: number, reason: string): Product | null {
  const store = loadStore();
  const prod = store.products.find(p => p.id === productId);
  if (!prod) return null;

  const beforeQty = prod.currentStock;
  const afterQty = beforeQty + adjustQty;
  prod.currentStock = afterQty;

  store.inventoryLogs.unshift({
    id: `log-adj-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    productId: prod.id,
    productName: prod.name,
    spec: prod.spec,
    changeType: adjustQty >= 0 ? 'adjust_plus' : 'adjust_minus',
    changeQty: Math.abs(adjustQty),
    beforeQty,
    afterQty,
    reason: reason || '재고 실사 수기 조정',
    createdAt: new Date().toISOString()
  });

  saveStore(store);
  return prod;
}
