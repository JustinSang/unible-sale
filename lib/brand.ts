// 고객사별 «표지»(이름·업종 문구·도장·기본 회사정보·기능 켜기) — 고객사마다 따로 설치하는 방식(A안)에서 코드를 고치지 않고 환경변수로 바꾼다.
// NEXT_PUBLIC_ 값은 «빌드할 때» 박힌다 → 고객사마다 자기 배포를 따로 빌드한다. 아무것도 설정하지 않으면 지금까지와 똑같이 동산화스너로 동작한다(동산화스너는 변경 없이 그대로 사용).
// 새 고객사: NEXT_PUBLIC_TENANT=custom + NEXT_PUBLIC_COMPANY_NAME 등을 넣는다(설치 절차: docs/고객사_설치_가이드.md). 회사 상세 정보(사업자번호·대표·주소 등)는 설치 뒤 «환경설정»에서 입력해 DB에 저장한다.
export interface CompanyDefaults { name: string; bizNumber: string; ceo: string; address: string; tel: string; fax: string; bizType: string; bizItem: string }

// 동산화스너 전용 기본값은 «동산화스너 배포일 때만» 불러온다(다른 고객사 빌드에서는 아래 조건이 빌드 때 거짓으로 접혀 파일 자체가 번들에 안 들어간다). 값이 비었거나 'dongsan'이면 동산화스너 — 오타(예: 'acme')는 custom으로 취급해 동산화스너 정보가 새어 나가지 않게 한다.
export const IS_DONGSAN = (process.env.NEXT_PUBLIC_TENANT || 'dongsan') === 'dongsan';
/* eslint-disable @typescript-eslint/no-require-imports */
const D: { DONGSAN: CompanyDefaults; DONGSAN_PAGE: CompanyDefaults } | null = (process.env.NEXT_PUBLIC_TENANT || 'dongsan') === 'dongsan' ? require('./brandDongsan') : null;
/* eslint-enable @typescript-eslint/no-require-imports */
const GENERIC = (): CompanyDefaults => ({ name: process.env.NEXT_PUBLIC_COMPANY_NAME || '고객사', bizNumber: '', ceo: '', address: '', tel: '', fax: '', bizType: '', bizItem: '' });

// process.env.NEXT_PUBLIC_X 는 «리터럴로 쓴 곳»만 빌드 때 치환되므로 아래처럼 하나씩 직접 쓴다(동적 접근 불가).
export const BRAND = {
  product: 'UNIBLE SALE',
  productKo: '유니블 세일',
  version: 'v3.5.0',
  company: D ? D.DONGSAN.name : (process.env.NEXT_PUBLIC_COMPANY_NAME || '고객사'),
  dept: D ? '물류본부' : (process.env.NEXT_PUBLIC_COMPANY_DEPT ?? ''),
  // 한 줄 소개용 업종 문구(검색엔진 설명 등)
  tagline: D ? '볼트, 너트, 화스너' : (process.env.NEXT_PUBLIC_COMPANY_TAGLINE ?? ''),
  // 업종 안내 문구(품목관리 화면 설명 등)
  items: D ? '볼트, 너트, 와셔, 앙카, 찬넬' : (process.env.NEXT_PUBLIC_COMPANY_ITEMS ?? ''),
  // 인쇄 양식 도장 그림(공급자 칸). 빈 문자열이면 도장 없이 인쇄한다.
  seal: D ? '/seal-real.png' : (process.env.NEXT_PUBLIC_SEAL_PATH ?? ''),
  // 미동이엔씨 파트너 포털 연동(동산화스너 주거래처 전용)은 동산화스너에서만 켠다(다른 고객사에는 코드째 들어가지 않는다).
  featureMidong: !!D,
  // 회사 정보 기본값: DB에 저장된 회사 정보가 없을 때만 쓰인다. 고객사는 비워 두고 환경설정에서 입력.
  companyDefaults: (D ? D.DONGSAN : GENERIC()) as CompanyDefaults,
  companyDefaultsPage: (D ? D.DONGSAN_PAGE : GENERIC()) as CompanyDefaults,
};
export const brandTitle = `${BRAND.product} (${BRAND.productKo}) - ${BRAND.company} 클라우드 ERP`;
