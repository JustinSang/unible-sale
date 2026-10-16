#!/bin/bash
# 코드를 고친 뒤 운영 웹(3300)에 반영한다. 운영 서버가 쓰는 .next 를 건드리지 않고 .next-build 에 먼저 빌드하고, 성공하면 폴더를 바꿔 끼우고 재시작한다.
# 재시작 뒤 응답이 없으면 이전 빌드로 자동으로 되돌린다. 끊기는 시간은 몇 초.
# 사용: bash scripts/server/deploy.sh
set -uo pipefail
cd "$(dirname "$0")/../.."; UIDN=$(id -u); LABEL=com.unible.sale.web
# bootout 은 비동기라 곧바로 bootstrap 하면 «Input/output error»가 난다(2026-10-16 실측) — 완전히 내려갈 때까지 기다리고 몇 번 다시 시도한다.
stop_web() { launchctl bootout gui/$UIDN/$LABEL 2>/dev/null || true; for i in $(seq 1 20); do launchctl print gui/$UIDN/$LABEL >/dev/null 2>&1 || return 0; sleep 1; done; }
start_web() { for i in 1 2 3 4 5 6; do launchctl bootstrap gui/$UIDN "$HOME/Library/LaunchAgents/$LABEL.plist" 2>/dev/null && return 0; sleep 3; done; return 1; }
echo "[1/4] 새 빌드(.next-build) 만드는 중… (3~5분, 그동안 기존 화면은 정상 동작)"
rm -rf .next-build
NEXT_DIST_DIR=.next-build NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local npx next build --webpack > data/live/build.log 2>&1 || { echo "빌드 실패 — 운영 화면은 그대로입니다. data/live/build.log 확인"; rm -rf .next-build; exit 1; }
echo "[2/4] 서버를 잠깐 멈추고 폴더 교체"
stop_web
rm -rf .next-old; [ -d .next ] && mv .next .next-old; mv .next-build .next
echo "[3/4] 다시 시작"
start_web || echo "bootstrap 재시도 실패"
for i in $(seq 1 30); do code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 localhost:3300/login); [ "$code" = "200" ] && break; sleep 2; done
if [ "$code" != "200" ]; then
  echo "[!] 새 빌드가 응답하지 않아 이전 빌드로 되돌립니다"; stop_web
  rm -rf .next-failed; mv .next .next-failed; [ -d .next-old ] && mv .next-old .next
  start_web; sleep 6; echo "되돌림 후 HTTP $(curl -s -o /dev/null -w '%{http_code}' localhost:3300/login)"; exit 1
fi
echo "[4/4] 완료 — 웹 HTTP $code (이전 빌드는 .next-old 에 남겨 둠, 다음 배포 때 지워짐)"
