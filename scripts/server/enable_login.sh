#!/bin/bash
# 로그인 켜기/끄기. 비밀번호는 이 스크립트가 터미널에서 직접 묻는다(화면에 안 보임·파일에는 해시만 저장).
#   켜기: bash scripts/server/enable_login.sh        ← 사용자(아이디·이름·역할·비밀번호)를 하나씩 입력, 관리자(admin) 한 명 이상 필수
#   끄기: bash scripts/server/enable_login.sh --off  ← app.env 에서 로그인 두 줄만 빼고 웹 재시작(다른 설정은 그대로)
# 하는 일: ①data/live/app.env 를 «복사해 두고»(app.env.bak_날짜) ②AUTH_SECRET·AUTH_USERS 를 «작은따옴표로 감싸» 쓴다(문서의 따옴표 없는 예시는 $·" 때문에 셸이 못 읽는다) ③웹(launchd com.unible.sale.web)만 다시 시작.
# 시험용: NO_RESTART=1 이면 웹을 다시 시작하지 않는다. UNIBLE_LIVE_DIR 로 다른 폴더를 가리킬 수 있다.
# 한계: 사용자 정보를 바꾸려면 다시 실행한다(전체를 다시 입력). 켠 뒤에도 DB 서버(54321)는 이 컴퓨터 안에서만 열려 있다.
set -euo pipefail
cd "$(dirname "$0")/../.."
LIVE="${UNIBLE_LIVE_DIR:-$(pwd)/data/live}"; ENVF="$LIVE/app.env"; mkdir -p "$LIVE"
TS=$(date +%Y%m%d_%H%M%S)
restart() {
  [ "${NO_RESTART:-}" = "1" ] && { echo "(NO_RESTART=1 — 웹을 다시 시작하지 않았습니다)"; return; }
  launchctl kickstart -k "gui/$(id -u)/com.unible.sale.web"
  for i in $(seq 1 40); do [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 localhost:3300/login)" = "200" ] && break; sleep 2; done
  echo "웹 응답: /login $(curl -s -o /dev/null -w '%{http_code}' localhost:3300/login) · / → $(curl -s -o /dev/null -w '%{http_code}' localhost:3300/) (로그인이 켜져 있으면 /는 307)"
}
strip_auth() { [ -f "$ENVF" ] && grep -vE '^(AUTH_SECRET|AUTH_USERS)=' "$ENVF" || true; }
if [ "${1:-}" = "--off" ]; then
  [ -f "$ENVF" ] || { echo "app.env 가 없어 이미 꺼져 있습니다."; exit 0; }
  cp "$ENVF" "$ENVF.bak_$TS"; strip_auth > "$ENVF.tmp"; mv "$ENVF.tmp" "$ENVF"; chmod 600 "$ENVF"
  echo "로그인을 껐습니다(복사본: app.env.bak_$TS)."; restart; exit 0
fi
USERS=()
HAS_ADMIN=0
echo "사용자를 입력합니다. 아이디 칸에서 그냥 Enter 를 치면 입력을 마칩니다."
while true; do
  read -r -p "아이디(영문·숫자 2~20자, 끝내려면 Enter): " ID
  [ -z "$ID" ] && break
  [[ "$ID" =~ ^[A-Za-z0-9_.-]{2,20}$ ]] || { echo "  아이디는 영문·숫자·_.- 2~20자입니다."; continue; }
  read -r -p "이름(화면에 표시): " NAME
  [[ -n "$NAME" && ! "$NAME" =~ [\'\"\\\$\`] ]] || { echo "  이름은 비울 수 없고 ' \" \\ \$ \` 는 쓸 수 없습니다."; continue; }
  read -r -p "역할(admin=관리자, staff=직원: 삭제·설정·변경 이력 조회 불가) [staff]: " ROLE; ROLE="${ROLE:-staff}"
  [[ "$ROLE" == admin || "$ROLE" == staff ]] || { echo "  역할은 admin 또는 staff 입니다."; continue; }
  read -r -s -p "비밀번호(8자 이상): " PW; echo; read -r -s -p "비밀번호 확인: " PW2; echo
  [ "$PW" = "$PW2" ] || { echo "  두 비밀번호가 다릅니다."; continue; }
  [ ${#PW} -ge 8 ] || { echo "  8자 이상이어야 합니다."; continue; }
  LINE=$(PW="$PW" node scripts/make_auth_user.mjs "$ID" "$NAME" "$ROLE") || { echo "  해시를 만들지 못했습니다."; continue; }
  unset PW PW2; USERS+=("$LINE"); [ "$ROLE" = admin ] && HAS_ADMIN=1; echo "  → $ID($NAME, $ROLE) 추가"
done
[ ${#USERS[@]} -ge 1 ] && [ $HAS_ADMIN -eq 1 ] || { echo "관리자(admin)를 포함해 한 명 이상 입력해야 합니다. 아무것도 바꾸지 않았습니다."; exit 1; }
JSON=$(printf '%s\n' "${USERS[@]}" | node -e 'const l=require("fs").readFileSync(0,"utf8").trim().split("\n").map(x=>JSON.parse(x)); const ids=l.map(u=>u.id); if(new Set(ids).size!==ids.length){console.error("중복 아이디");process.exit(1)} console.log(JSON.stringify(l))') || { echo "아이디가 겹칩니다. 아무것도 바꾸지 않았습니다."; exit 1; }
SECRET=""; [ -f "$ENVF" ] && SECRET=$(grep -E '^AUTH_SECRET=' "$ENVF" | head -1 | sed -E "s/^AUTH_SECRET='?//; s/'?$//" || true)
[ -n "$SECRET" ] || SECRET=$(openssl rand -base64 48 | tr -d '\n')
[ -f "$ENVF" ] && cp "$ENVF" "$ENVF.bak_$TS"
{ strip_auth; echo "AUTH_SECRET='$SECRET'"; echo "AUTH_USERS='$JSON'"; } > "$ENVF.tmp"; mv "$ENVF.tmp" "$ENVF"; chmod 600 "$ENVF"
echo "저장했습니다: $ENVF (사용자 ${#USERS[@]}명, 비밀번호는 해시로만 저장)"
restart
