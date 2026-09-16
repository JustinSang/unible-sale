export type OSTheme = 'modern-win' | 'macos' | 'winxp-retro';

export interface Product {
  id: string;
  code: string;
  name: string;
  spec: string;
  unit: string;
  costPrice: number;     // 매입가
  sellingPrice: number;  // 출고가 (단가1)
  sellingPrice2?: number;// 출고가 (단가2)
  sellingPrice3?: number;// 출고가 (단가3)
  discountRate?: number; // 할인율 (%)
  currentStock: number;  // 현재고
  safeStock: number;     // 적정재고
  category: string;      // 카테고리 대분류
  category2?: string;    // 카테고리 중분류
  category3?: string;    // 카테고리 소분류
  barcode?: string;
  supplier?: string;
  memo?: string;
}

export interface CustomerSite {
  id: string;          // siteId (e.g. "site-801740")
  siteCode: string;    // PostID (e.g. "801740")
  siteName: string;    // Post (e.g. "김포데이터센터")
  manager?: string;    // 현장 담당자/소장
  tel?: string;        // 현장 전화번호
  address?: string;    // 현장 주소
  receivables?: number;// 현장별 미수잔액
  memo?: string;       // 현장 비고/특이사항
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  bizNumber: string;
  subBizNumber?: string; // 종사업자번호
  ceo: string;
  tel: string;
  fax?: string;
  mobile?: string;
  address: string;
  bizType?: string;      // 업태
  bizItem?: string;      // 종목
  receivables: number;   // 미수금
  payables?: number;     // 외상매입금
  closingDay?: number;   // 마감일 (예: 25일, 30일)
  priceTier?: 1 | 2 | 3; // 단가 등급 (1, 2, 3)
  email?: string;
  taxEmail?: string;     // 세금계산서 전용 이메일
  memo?: string;
  post?: string;         // 메인 현장명
  sites?: CustomerSite[]; // 거래처 산하 복수 공사현장 (1:N)
}

export interface SlipItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  spec: string;
  unit: string;
  qty: number;
  unitPrice: number;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  memo?: string;
}

export type SlipType = 'sales' | 'purchase' | 'return_sales' | 'return_purchase';

export interface Slip {
  id: string;
  slipNo: string;           // 전표번호 (예: S20260316-0001)
  slipDate: string;         // YYYY-MM-DD
  slipType: SlipType;       // 'sales'(매출), 'purchase'(매입) 등
  customerId: string;
  customerName: string;
  siteId?: string;          // 현장 ID/코드
  siteName?: string;        // 현장명 (예: 김포데이터센터)
  siteManager?: string;     // 현장 담당자
  siteAddress?: string;     // 현장 납품지 주소
  items: SlipItem[];
  totalSupplyAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  paymentType: 'credit' | 'cash' | 'card' | 'mixed'; // 외상, 현금, 카드
  paidAmount: number;       // 결제(입금/지급) 금액
  unpaidAmount: number;     // 잔액/미수금
  prevReceivables?: number; // 거래 전 미수잔액
  memo?: string;
  createdAt: string;
  deliveryStatus?: 'none' | 'pending' | 'shipping' | 'delivered';
}

export interface DeliveryOrder {
  id: string;
  slipId: string;
  slipNo: string;
  customerName: string;
  siteId?: string;
  siteName?: string;
  address: string;
  tel: string;
  driverName?: string;
  driverTel?: string;
  status: 'pending' | 'dispatched' | 'delivering' | 'delivered' | 'cancelled';
  requestedDate: string;
  deliveredDate?: string;
  itemsSummary: string;
  memo?: string;
}

export interface InventoryLog {
  id: string;
  date: string;
  productId: string;
  productName: string;
  spec: string;
  changeType: 'in' | 'out' | 'adjust_plus' | 'adjust_minus' | 'return';
  changeQty: number;
  beforeQty: number;
  afterQty: number;
  slipNo?: string;
  reason: string;
  createdAt: string;
}

export interface SystemConfig {
  dbPath: string;
  reportPath: string;
  printers: {
    slipPrinter: string;
    taxPrinter: string;
    printer: string;
  };
  cloudSyncEnabled: boolean;
  syncIntervalSec: number;
  lastSyncTime: string;
  companyInfo: {
    name: string;
    bizNumber: string;
    ceo: string;
    address: string;
    tel: string;
    bizType: string;
    bizItem: string;
  };
}

export interface Bill {
  id: string;
  billNo: string;
  billKind: '받을어음' | '지급어음';
  amount: number;
  issueDate: string;
  dueDate: string;
  customerName: string;
  bank: string;
  status: '정상' | '결제완료' | '부도' | '할인';
  memo?: string;
}

export interface TaxInvoice {
  id: string;
  taxNo: string;
  taxDate: string;
  customerName: string;
  productSummary: string;
  supplyAmount: number;
  taxAmount: number;
  totalAmount: number;
  isIssued: boolean;
  ntsSendStatus?: 'pending' | 'success' | 'failed'; // 국세청 전송 상태
  ntsIssueId?: string; // 국세청 승인번호
  memo?: string;
}

export interface CollectionPayment {
  id: string;
  date: string;
  type: 'collection' | 'payment'; // 수금(collection) 또는 지급(payment)
  customerId: string;
  customerName: string;
  method: 'cash' | 'bank' | 'bill'; // 현금, 통장, 어음
  amount: number;
  prevBalance: number;
  currentBalance: number;
  memo?: string;
}

export interface CustomerPriceItem {
  productId: string;
  productName: string;
  spec: string;
  price1: number;
  price2: number;
  price3: number;
}

