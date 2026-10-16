// 고객사 배포용 빌드 전 정리: 동산화스너 전용 파일(회사 도장 그림·화면 캡처)을 빌드 결과에서 뺀다.
// NEXT_PUBLIC_TENANT 가 비어 있거나 'dongsan' 이면 아무것도 하지 않는다(동산화스너 배포는 그대로).
// 고객사 Vercel 프로젝트의 Build Command 를 `npm run build:tenant` 로 둔다. 로컬 작업 폴더가 아니라 «빌드 서버의 복사본»에서만 지운다 — 내 컴퓨터에서 직접 돌리지 말 것.
import { rmSync, existsSync } from 'fs';
const tenant = process.env.NEXT_PUBLIC_TENANT || 'dongsan';
if (tenant === 'dongsan') { console.log('[prepare_tenant] dongsan — 변경 없음'); process.exit(0); }
if (!process.env.VERCEL && !process.env.CI && process.env.FORCE_PREPARE_TENANT !== '1') { console.error('[prepare_tenant] 빌드 서버(VERCEL/CI)가 아니면 파일을 지우지 않습니다. 정말 지우려면 FORCE_PREPARE_TENANT=1'); process.exit(0); }
for (const p of ['public/seal-real.png', 'public/seal.png', 'public/screenshots']) {
  if (existsSync(p)) { rmSync(p, { recursive: true, force: true }); console.log('[prepare_tenant] 삭제:', p); }
}
