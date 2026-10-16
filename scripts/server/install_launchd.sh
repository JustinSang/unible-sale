#!/bin/bash
# 동산화스너가 «컴퓨터를 껐다 켜도» 바로 쓰도록 3개를 자동 실행으로 등록한다(사용자 LaunchAgents, 관리자 권한 불필요).
#   com.unible.sale.localdb  — 로컬 DB 서버(127.0.0.1:54321, 꺼지면 자동 재시작)
#   com.unible.sale.web      — UNIBLE SALE 웹(프로덕션, 포트 3300)
#   com.unible.sale.backup   — 매일 03:10 DB 백업을 구글 드라이브로
# 사용: bash scripts/server/install_launchd.sh [--no-build]     되돌리기: bash scripts/server/install_launchd.sh --remove
# 주의: 3300 포트의 개발 서버(npm run dev)는 이 스크립트가 끈다. 로그인을 켜려면 data/live/app.env 에 AUTH_SECRET·AUTH_USERS 를 넣고 `launchctl kickstart -k gui/$(id -u)/com.unible.sale.web`.
set -euo pipefail
cd "$(dirname "$0")/../.."; ROOT=$(pwd); UIDN=$(id -u); LA="$HOME/Library/LaunchAgents"; mkdir -p "$LA" data/live
LABELS=(com.unible.sale.localdb com.unible.sale.web com.unible.sale.backup)
if [ "${1:-}" = "--remove" ]; then for l in "${LABELS[@]}"; do launchctl bootout gui/$UIDN/$l 2>/dev/null || true; rm -f "$LA/$l.plist"; done; echo "등록 해제 완료(데이터는 그대로)"; exit 0; fi
plist() { # $1=label $2=스크립트 $3=추가 키 xml
cat > "$LA/$1.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>$1</string>
<key>ProgramArguments</key><array><string>/bin/bash</string><string>$ROOT/scripts/server/$2</string></array>
<key>WorkingDirectory</key><string>$ROOT</string>
<key>StandardOutPath</key><string>$ROOT/data/live/$1.stdout.txt</string>
<key>StandardErrorPath</key><string>$ROOT/data/live/$1.stderr.txt</string>
$3
</dict></plist>
EOF
}
plist com.unible.sale.localdb run_db.sh '<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>'
plist com.unible.sale.web run_web.sh '<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>'
plist com.unible.sale.backup backup_to_drive.sh '<key>StartCalendarInterval</key><dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>10</integer></dict>'
if [ "${1:-}" != "--no-build" ]; then
  echo "프로덕션 빌드 중(3~5분)…"; NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local npx next build --webpack > data/live/build.log 2>&1 || { echo "빌드 실패 — data/live/build.log 확인"; exit 1; }
fi
# 이미 떠 있는 3300(개발 서버)·54321(임시 DB 서버)은 launchd 쪽으로 넘기려고 끈다
for port in 3300 54321; do pid=$(lsof -nP -iTCP:$port -sTCP:LISTEN -t 2>/dev/null || true); [ -n "$pid" ] && kill $pid && echo "포트 $port 기존 프로세스($pid) 종료"; done
sleep 2
for l in "${LABELS[@]}"; do launchctl bootout gui/$UIDN/$l 2>/dev/null || true; launchctl bootstrap gui/$UIDN "$LA/$l.plist"; done
for i in $(seq 1 40); do curl -s -o /dev/null --max-time 2 localhost:3300/login && break; sleep 2; done
echo "확인: DB $(curl -s -o /dev/null -w '%{http_code}' 127.0.0.1:54321/rest/v1/system_config) · 웹 $(curl -s -o /dev/null -w '%{http_code}' localhost:3300/)"
launchctl list | grep com.unible.sale || true
