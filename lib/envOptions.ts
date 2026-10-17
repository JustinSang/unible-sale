// 사용자 환경설정(원본 «사용자 환경설정» 창 중 이 앱에서 실제로 동작을 연결한 항목). system_config.config.options 에 저장한다.
// 원본 항목 전수 대조와 «아직 연결하지 않은 항목»은 docs/oksale-parity/환경설정_원본항목_대조_2026-10-17.md 에 있다.
export interface EnvOptions {
  priceDecimals: 0 | 1 | 2;      // 단가 소수점 자리수(원본 «단가 소수점») — 전표 입력 때 기본값
  qtyDecimals: 0 | 1 | 2 | 3;    // 수량 소수점 자리수(원본 «수량 소수점»)
  vatRate: number;               // 부가가치세 세율 %(원본 «부가가치세세율»)
  creditLimitCheck: boolean;     // 여신한도관리: 매출 저장 때 거래처 여신한도를 넘으면 확인을 묻는다(원본의 정확한 동작은 미확인 — 경고 후 진행 선택으로 만듦)
  autoSaveSalesPrice: boolean;   // 매출가 자동저장(원본): 매출 저장 때 거래처별 단가 이력 갱신
  autoSavePurchasePrice: boolean; // 매입가 자동저장(원본): 매입 저장 때 품목의 매입단가·최종매입처 갱신
  productSearch: 'basic' | 'words'; // 상품검색방법(원본 «상품검색방법»): basic=입력한 글자 전체를 한 덩어리로 찾음(기존), words=띄어 쓴 단어가 모두 들어간 품목(품명+규격)
  quickAddProduct: boolean;      // 전표신규상품저장(원본): 검색 결과가 없을 때 전표 입력 중에 새 품목을 바로 등록해 담는다(원본의 정확한 동작은 미확인 — 이 앱 방식으로 만듦)
  print?: Partial<PrintOptions>; // 거래명세표 선택 추가 출력
}
export const DEFAULT_OPTIONS: EnvOptions = { priceDecimals: 0, qtyDecimals: 0, vatRate: 10, creditLimitCheck: false, autoSaveSalesPrice: true, autoSavePurchasePrice: true, productSearch: 'basic', quickAddProduct: false };

const pick = <T extends number>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(Number(v) as T) ? (Number(v) as T) : d);

// 없거나 이상한 값은 기본값으로(기존 동작 그대로).
export function normalizeOptions(raw?: Partial<EnvOptions> | null): EnvOptions {
  const o = raw || {};
  const vat = Number(o.vatRate);
  return {
    priceDecimals: pick(o.priceDecimals, [0, 1, 2] as const, 0),
    qtyDecimals: pick(o.qtyDecimals, [0, 1, 2, 3] as const, 0),
    vatRate: Number.isFinite(vat) && vat >= 0 && vat <= 100 ? vat : DEFAULT_OPTIONS.vatRate,
    creditLimitCheck: o.creditLimitCheck === true,
    autoSaveSalesPrice: o.autoSaveSalesPrice !== false,
    autoSavePurchasePrice: o.autoSavePurchasePrice !== false,
    productSearch: o.productSearch === 'words' ? 'words' : 'basic',
    quickAddProduct: o.quickAddProduct === true,
    print: normalizePrint(o.print) // 다른 항목을 저장할 때 출력 옵션이 사라지지 않게 함께 돌려준다
  };
}
// 거래명세표 «선택 추가 출력»(기본은 모두 꺼짐 = 지금 출력과 똑같다). 원본 Slip.rpt 에는 이 요소들이 없어(캡션 전수 확인) 원본 복원이 아니라 이 앱의 추가 기능이다.
export interface PrintOptions {
  siteName: boolean;       // 현장명 출력 — 머리 왼쪽 가운데 빈 칸에 «현장: …»
  messageOn: boolean;      // 안내문 출력 — 아래 왼쪽에 한 줄
  message: string;         // 안내문 내용(60자까지, 예: 입금 계좌 안내)
  approvalOn: boolean;     // 결재란 출력 — 제목 오른쪽에 칸
  approvalLabels: string;  // 결재란 칸 이름(쉼표로 구분, 최대 4개, 기본 «담당,대표»)
}
export const DEFAULT_PRINT: PrintOptions = { siteName: false, messageOn: false, message: '', approvalOn: false, approvalLabels: '담당,대표' };
export function normalizePrint(raw?: Partial<PrintOptions> | null): PrintOptions {
  const o = raw || {};
  const labels = String(o.approvalLabels ?? DEFAULT_PRINT.approvalLabels).split(',').map(s => s.trim().slice(0, 4)).filter(Boolean).slice(0, 4).join(',') || DEFAULT_PRINT.approvalLabels;
  return { siteName: o.siteName === true, messageOn: o.messageOn === true, message: String(o.message || '').replace(/[\r\n]+/g, ' ').slice(0, 60), approvalOn: o.approvalOn === true, approvalLabels: labels };
}
export const roundTo = (n: number, d: number) => { const f = Math.pow(10, d); return Math.round((Number(n) + Number.EPSILON) * f) / f; };
