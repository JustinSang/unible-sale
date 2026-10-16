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
  applyDiscount?: boolean; // 할인율 적용 여부 (오케이세일 ChkDiscountRate)
  maker?: string;        // 메이커
  modelNo?: string;      // 모델 No
  color?: string;        // 색상
  retailPrice?: number;  // 소비자가
  purchasePrice?: number; // 매입단가
  lastPurchaseDate?: string; // 최종 매입일
  lastPurchasePrice?: number; // 최종 매입가
  supplier2?: string;          // 최종매입처2(원본 SupplierID2) — 직전 매입처
  lastPurchaseDate2?: string;  // 최종매입일2(PurchaseDate2)
  lastPurchasePrice2?: number; // 최종매입가2(PurchasePrice2)
  openingStock?: number;       // 이월재고(원본 Stock S00) — 사용 이전/전년도 말 재고
  storageLocation?: string; // 보관 위치
  taxType?: 'taxable' | 'exempt'; // 과세 여부
  stockManaged?: boolean; // 재고관리 여부
  currentStock: number;  // 현재고
  safeStock: number;     // 적정재고
  category: string;      // 카테고리 대분류
  category2?: string;    // 카테고리 중분류
  category3?: string;    // 카테고리 소분류
  barcode?: string;
  nickName?: string;     // 다른명칭(약어·관리코드, 원본 NicName)
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
  creditLimit?: number;  // 여신한도액
  salesman?: string;     // 영업사원
  grade?: string;        // 고객등급
  minMarginRate?: number; // 최소마진율 (%)
  contactName?: string;  // 담당자
  contactDuty?: string;  // 직책
  homepage?: string;
  zip?: string;          // 우편번호
  bank?: string;         // 은행
  accountHolder?: string; // 예금주
  account?: string;      // 계좌번호
  taxEmail?: string;     // 세금계산서 전용 이메일
  memo?: string;
  category?: string;     // 구분(거래등급·거래처구분, 원본 Category)
  vatType?: 'incl' | 'excl' | 'none'; // 부가세 적용(원본 TaxType 1.포함 2.별도 3.없음) — 전표 입력 때 기본 부가세 모드
  tel2?: string;         // 전화2(직통, 원본 TelephoneNo2)
  tel3?: string;         // 전화3(담당자, 원본 TelephoneNo3)
  title?: string;        // 우편발송용 존칭(원본 Title)
  address2?: string;     // 주소 상세(원본 Address1-1)
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
  discountRate?: number; // 할인율(%) — 협정가×(100+할인율)/100 로 단가 계산(원본 F4 협정)
  memo?: string;
}

export type SlipType = 'SALES' | 'PURCHASE' | 'RETURN_IN' | 'RETURN_OUT' | 'ESTIMATE' | 'ORDER' | 'DELIVERY' | 'CONTRACT';

export interface DispatchStatus {
  printCount: number;
  faxStatus: 'IDLE' | 'SENDING' | 'SUCCESS' | 'FAIL';
  kakaoStatus: 'IDLE' | 'SENDING' | 'SUCCESS' | 'FAIL';
  emailStatus: 'IDLE' | 'SENDING' | 'SUCCESS' | 'FAIL';
  faxAt?: string; faxTo?: string;     // 마지막 팩스 발송 시각·번호(발송 이력)
  emailAt?: string; emailTo?: string;
  kakaoAt?: string; kakaoTo?: string;
}

export interface Slip {
  id: string;
  linkedFromId?: string;    // O2C 연동 원본 전표 ID
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
  showPrevBalance?: boolean; // 명세표에 전잔액 출력(원본 «전잔액출력» 체크, 미지정=출력)
  memo?: string;
  createdAt: string;
  deliveryStatus?: 'none' | 'pending' | 'shipping' | 'delivered';
  dispatchStatus?: DispatchStatus;
  digitalSignature?: string; // 전자서명 위변조 방지 해시
  tsaToken?: string;         // RFC 3161 공인 타임스탬프 대체 토큰
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
  calc?: { amt: 'R' | 'F' | 'C'; vat: 'R' | 'F' | 'C' }; // 금액 반올림 설정(공급가액·부가세). 없으면 둘 다 반올림(R)=기존 동작
  adminPinHash?: string; // 관리자 모드 PIN의 SHA-256(발송된 전표 수정·삭제 허용)
  openingBalances?: { asOf: string; byCustomer: Record<string, number> }; // 기초 미수(+)·미지급(−) 잔액 — 도입 시점 입력
  lastSyncTime: string;
  companyInfo: {
    name: string;
    bizNumber: string;
    ceo: string;
    address: string;
    tel: string;
    fax?: string;
    email?: string;
    bizType: string;
    bizItem: string;
  };
}

export type BillStatus = '보유' | '결제' | '할인' | '부도' | '배서' | '미결제' | '정상' | '결제완료'; // 정상·결제완료는 이관 전 옛 표기(정상=보유/미결제, 결제완료=결제)

export interface Bill {
  id: string;
  billNo: string;
  billKind: '받을어음' | '지급어음';
  amount: number;
  issueDate: string;
  dueDate: string;        // 만기일(원본 FallDate)
  customerName: string;   // 받을어음=받은 거래처(ReceiptCustomerName), 지급어음=지급 거래처(PayCustomerName)
  bank: string;           // 발행은행(IssueBank)
  status: BillStatus;     // 받을어음: 보유·결제·할인·부도·배서 / 지급어음: 미결제·결제 (원본 BillStatusMode 1~6)
  memo?: string;
  receiptDate?: string;   // 수취일(ReceiptDate)
  issuer?: string;        // 발행인(IssuerName)
  issueSite?: string;     // 발행지(IssueSite)
  payBank?: string;       // 결제은행(PayBank)
  payCustomerName?: string; // 배서처(받을어음을 넘긴 곳)
  payDate?: string;       // 결제일·배서일(PayDate)
  discountDate?: string;
  discountCustomer?: string;
  discountRate?: number;
  discountPeriod?: number;
  discountAmount?: number;
  dishonorDate?: string;  // 부도일
  releaseDishonorDate?: string; // 부도 해제일
}

export interface TaxInvoice {
  id: string;
  taxNo: string;
  taxDate: string;
  taxKind?: '1' | '2' | 'B';       // OkSale TaxKind: 1=매출, 2=매입, B=매입합계
  customerId?: string;              // OkSale CustomerID 연결
  customerName: string;
  postId?: string;                  // OkSale PostID (현장 ID)
  postName?: string;                // OkSale Post (현장명)
  productSummary: string;           // OkSale ProductName
  spec?: string;                    // OkSale Spec (규격)
  qty?: number;                     // OkSale Qty (수량)
  unitPrice?: number;               // OkSale UnitPrice (단가)
  emptyCount?: number;              // OkSale EmptyCount (공란 수)
  supplyAmount: number;             // OkSale Amount (공급가액)
  taxAmount: number;                // OkSale Tax (세액)
  totalAmount: number;              // OkSale Total (합계)
  isIssued: boolean;                // OkSale CheckIssue
  checkReceipt?: '영수' | '청구';   // OkSale CheckReceipt (영수/청구)
  checkSale?: '1' | '0';           // OkSale CheckSale (매출=1/매입=0 구분)
  ntsSendStatus?: 'pending' | 'success' | 'failed'; // 국세청 전송 상태
  ntsIssueId?: string;             // 국세청 승인번호 (OkSale AccountBookNo)
  memo?: string;                   // OkSale Comments
}

export interface CollectionPayment {
  id: string;
  date: string;
  type: 'collection' | 'payment'; // 수금(collection) 또는 지급(payment)
  customerId: string;
  customerName: string;
  method: 'cash' | 'bank' | 'bill'; // 현금, 통장, 어음
  amount: number;
  discount?: number;   // 할인액(원본 수금지급 «할인액»)
  billNo?: string;     // 어음번호(어음 수금·지급 때)
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

