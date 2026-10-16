// 동산화스너 전용 기본값. lib/brand.ts가 «동산화스너 배포일 때만» 불러온다 — 다른 고객사 빌드에는 이 파일(사업자번호·대표 이름 등)이 들어가지 않는다.
import type { CompanyDefaults } from '@/lib/brand';
export const DONGSAN: CompanyDefaults = { name: '동산화스너', bizNumber: '202-14-62327', ceo: '상원준', address: '고양시 덕양구 삼원로 73, 210호', tel: '02-2267-1300', fax: '02-2274-4386', bizType: '도매', bizItem: '볼트너트 철물외' };
// 첫 화면 기본값(예전 표기: 전화번호 괄호)
export const DONGSAN_PAGE: CompanyDefaults = { ...DONGSAN, tel: '02)2267-1300', fax: '02)2274-4386' };
