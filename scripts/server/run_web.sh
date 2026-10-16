#!/bin/bash
# launchd가 부르는 UNIBLE SALE 웹 서버(프로덕션 모드) 실행기.
# 환경변수: 로컬 DB 주소는 고정, 로그인(AUTH_*)·팝빌·이메일 키 등은 data/live/app.env 에 둔다(git에 안 올라감, 없으면 로그인 꺼진 채 동작).
cd "$(dirname "$0")/../.." || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321" NEXT_PUBLIC_SUPABASE_ANON_KEY="local" SUPABASE_SERVICE_ROLE_KEY="local"
[ -f data/live/app.env ] && set -a && . data/live/app.env && set +a
exec npx next start -p 3300
