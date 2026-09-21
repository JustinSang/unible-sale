<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:browser-verification-rule -->
# Browser Subagent Verification Rule

1. **시각적 렌더링 검증 의무 (Visual Verification Mandatory)**
   프론트엔드 코드(UI 구성요소, React 컴포넌트, 스타일링 등)를 수정하거나 신규 개발한 직후에는, "작업이 완료되었습니다"라고 보고하기 전에 **반드시** `browser_subagent` 툴을 호출해야 한다.

2. **접속 및 확인 프로세스**
   - 로컬 개발 서버(`npm run dev`, `localhost:3000` 등)가 띄워져 있는지 확인한다.
   - `browser_subagent`에 명확한 `Task` 프롬프트를 부여하여, "http://localhost:3000 에 접속해서 방금 내가 작성한 특정 UI 요소가 잘 렌더링 되는지 100% 눈으로 확인하고 검증하라"고 지시한다.
   - 서브에이전트가 정상적으로 페이지를 확인하고 문제가 없음을 컨펌한 뒤에만 사용자에게 보고한다.

3. **이유 (Rationale)**
   - AI가 코드만 작성하고 머릿속으로 '잘 작동하겠지'라고 단정하는 할루시네이션을 방지하고, 실무 사용자의 100% 신뢰를 얻기 위함이다.
<!-- END:browser-verification-rule -->
