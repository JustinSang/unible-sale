#!/bin/bash
# 로그인 보호 종단 시험(실행 중인 서버에 대해). 서버는 AUTH_SECRET·AUTH_USERS를 켠 상태여야 한다.
# 사용: BASE=http://localhost:3301 ADMIN_ID=sang ADMIN_PW=... STAFF_ID=kim STAFF_PW=... bash scripts/test_auth_http.sh
# 주의: 5회 실패 잠금 시험을 위해 STAFF_ID로 일부러 틀린 로그인을 6번 보낸다(1분 뒤 풀림).
BASE=${BASE:-http://localhost:3301}; J=$(mktemp -d); FAILS=0
chk() { if [ "$2" = "$3" ]; then echo "PASS $1"; else echo "FAIL $1 (기대 $3, 실제 $2)"; FAILS=$((FAILS+1)); fi; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
body() { printf '{"id":"%s","password":"%s"}' "$1" "$2"; }
ADM_OK=$(body "$ADMIN_ID" "$ADMIN_PW"); STF_OK=$(body "$STAFF_ID" "$STAFF_PW"); ADM_BAD=$(body "$ADMIN_ID" "x-wrong")
chk "미로그인 화면 → 로그인으로 이동(307)" "$(code $BASE/)" 307
chk "미로그인 API → 401" "$(code $BASE/api/products)" 401
chk "로그인 화면은 공개(200)" "$(code $BASE/login)" 200
chk "틀린 비밀번호 → 401" "$(code -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "$ADM_BAD")" 401
chk "관리자 로그인 → 200" "$(code -c $J/a -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "$ADM_OK")" 200
chk "직원 로그인 → 200" "$(code -c $J/s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "$STF_OK")" 200
chk "로그인 후 API → 200" "$(code -b $J/s $BASE/api/products)" 200
chk "직원 삭제 → 403" "$(code -b $J/s -X DELETE $BASE/api/slips/none)" 403
chk "직원 변경이력 조회 → 403" "$(code -b $J/s $BASE/api/audit)" 403
chk "직원 미동 전환 → 403" "$(code -b $J/s -X POST $BASE/api/midong-orders/convert -H 'Content-Type: application/json' -d '{"action":"settle","ids":[]}')" 403
chk "관리자 삭제(없는 전표) → 404(막히지 않음)" "$(code -b $J/a -X DELETE $BASE/api/slips/none)" 404
chk "위조 쿠키 → 401" "$(code -b 'unible_session=abc.def' $BASE/api/products)" 401
chk "로그아웃 뒤 → 401" "$(curl -s -b $J/s -c $J/s2 -X POST $BASE/api/auth/logout >/dev/null; code -b $J/s2 $BASE/api/products)" 401
chk "직원 설정 변경 → 403" "$(code -b $J/s -X PUT $BASE/api/config -H 'Content-Type: application/json' -d '{}')" 403
chk "직원 mdb-analyze → 403" "$(code -b $J/s $BASE/api/mdb-analyze)" 403
chk "직원 reset-demo → 403" "$(code -b $J/s -X POST $BASE/api/reset-demo)" 403
chk "이미지 확장자 API 경로도 로그인 필요(401)" "$(code $BASE/api/slips/x.png)" 401
chk "이미지 확장자 DELETE도 로그인 필요(401)" "$(code -X DELETE $BASE/api/products/x.png)" 401
chk "회사 도장 그림은 로그인 필요(307)" "$(code $BASE/seal-real.png)" 307
chk "화면 캡처 그림은 로그인 필요(307)" "$(code $BASE/screenshots/tab3_customer.png)" 307
chk "글꼴은 공개(200)" "$(code $BASE/fonts/NanumGothic-Regular.ttf)" 200
chk "범위 없는 전환 요청 → 400(전체가 바뀌지 않음)" "$(code -b $J/a -X POST $BASE/api/midong-orders/convert -H 'Content-Type: application/json' -d '{"action":"toSales"}')" 400
PID=$(curl -s -b $J/s $BASE/api/products | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])" 2>/dev/null)
curl -s -b $J/s -o /dev/null -H "x-user-id: $ADMIN_ID" -H "x-role: admin" -X PUT $BASE/api/products/$PID -H 'Content-Type: application/json' -d '{"memo":"auth-test"}'
curl -s -b $J/s -o /dev/null -X PUT $BASE/api/products/$PID -H 'Content-Type: application/json' -d '{"memo":""}'
ACTOR=$(curl -s -b $J/a "$BASE/api/audit?entity=product" | python3 -c "import json,sys;r=sorted(json.load(sys.stdin),key=lambda x:x['at']);print(r[-1]['actor'])" 2>/dev/null)
chk "머리글 위조(x-user-id) 무시 — 변경이력 actor는 실제 로그인한 직원" "$ACTOR" "$STAFF_ID"
for i in 1 2 3 4 5; do curl -s -o /dev/null -H "X-Forwarded-For: 10.0.0.$i" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "$(body "$STAFF_ID" "bad$i")"; done
chk "접속지 머리글을 바꿔 5번 틀려도 맞는 비밀번호까지 429(잠금)" "$(code -H "X-Forwarded-For: 10.9.9.9" -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "$STF_OK")" 429
rm -rf $J; [ $FAILS -eq 0 ] && echo "결과: 전부 통과" || { echo "결과: 실패 $FAILS건"; exit 1; }
