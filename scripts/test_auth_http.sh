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
for i in 1 2 3 4 5; do curl -s -o /dev/null -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "$(body "$STAFF_ID" "bad$i")"; done
chk "5회 실패 뒤 맞는 비밀번호도 429(잠금)" "$(code -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d "$STF_OK")" 429
echo "머리글 위조 시험(직원이 x-user-id: $ADMIN_ID 를 보내도 변경이력에는 직원으로 남아야 함)은 수동 — docs 참고"
rm -rf $J; [ $FAILS -eq 0 ] && echo "결과: 전부 통과" || { echo "결과: 실패 $FAILS건"; exit 1; }
