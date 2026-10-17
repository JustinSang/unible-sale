#!/bin/bash
# 로컬 DB를 백업 파일로 되돌린다. 웹 화면에는 일부러 «복원 버튼»을 두지 않았다(로그인이 꺼져 있을 때 클릭 한 번으로 운영 자료가 덮어써지는 것을 막기 위해).
# 사용: bash scripts/server/restore_backup.sh <백업파일이름>           ← 미리보기(아무것도 바꾸지 않음)
#       bash scripts/server/restore_backup.sh <백업파일이름> --yes     ← 실제 복원
# 순서: ①백업 파일 검사(integrity_check) ②지금 자료와 표별 행 수 비교 ③지금 자료를 «복원 직전» 백업으로 저장 ④DB 서버 끄기 ⑤파일 교체 ⑥DB 서버 켜기·확인.
# 시험용: NO_LAUNCHCTL=1 이면 서버를 끄고 켜지 않고 파일만 바꾼다. UNIBLE_LIVE_DIR 로 다른 폴더를 가리킬 수 있다(운영 폴더를 건드리지 않고 시험).
set -euo pipefail
cd "$(dirname "$0")/../.."
NAME="${1:-}"; YES="${2:-}"
LIVE="${UNIBLE_LIVE_DIR:-$(pwd)/data/live}"; DB="$LIVE/unible_live.sqlite"; BK="$LIVE/backups"
[[ "$NAME" =~ ^unible_[0-9]{8}_[0-9]{6}[A-Za-z0-9_]*\.sqlite$ ]] || { echo "사용법: restore_backup.sh <unible_YYYYMMDD_HHMMSS….sqlite> [--yes]"; ls -t "$BK" 2>/dev/null | grep -E '\.sqlite$' | head -8; exit 2; }
SRC="$BK/$NAME"; [ -f "$SRC" ] || { echo "백업 파일이 없습니다: $SRC"; exit 2; }
IMM="file:$SRC?immutable=1"
[ "$(sqlite3 "$IMM" 'PRAGMA integrity_check' | head -1)" = "ok" ] || { echo "백업 파일이 손상됐습니다(integrity_check 실패). 복원하지 않습니다."; exit 3; }
echo "== 표별 행 수: 백업 ↔ 지금 =="
join -a1 -a2 -e 0 -o 0,1.2,2.2 -t'|' \
  <(sqlite3 "$IMM" 'select tbl,count(*) from rows group by tbl order by 1') \
  <(sqlite3 "$DB" 'select tbl,count(*) from rows group by tbl order by 1') | awk -F'|' '{printf "%-18s 백업 %8d  지금 %8d  차이 %+d\n",$1,$2,$3,$2-$3}'
if [ "$YES" != "--yes" ]; then echo; echo "미리보기입니다. 실제로 되돌리려면 같은 명령 끝에 --yes 를 붙이세요. 백업 이후에 입력한 전표 등은 사라집니다(복원 직전 사본은 자동 저장됩니다)."; exit 0; fi
TS=$(date +%Y%m%d_%H%M%S); SAFE="$BK/unible_${TS}_before_restore.sqlite"
sqlite3 "$DB" ".backup '$SAFE'" && echo "복원 직전 사본 저장: $SAFE"
UIDN=$(id -u); PLIST="$HOME/Library/LaunchAgents/com.unible.sale.localdb.plist"
if [ "${NO_LAUNCHCTL:-}" != "1" ]; then launchctl bootout gui/$UIDN/com.unible.sale.localdb 2>/dev/null || true; sleep 2; fi
rm -f "$DB-wal" "$DB-shm"; cp "$SRC" "$DB"
if [ "${NO_LAUNCHCTL:-}" != "1" ]; then
  launchctl bootstrap gui/$UIDN "$PLIST"
  for i in $(seq 1 30); do [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 127.0.0.1:54321/rest/v1/system_config)" = "200" ] && break; sleep 1; done
  echo "DB 서버 응답: $(curl -s -o /dev/null -w '%{http_code}' 127.0.0.1:54321/rest/v1/system_config)"
fi
echo "복원 완료: $NAME → $DB"; sqlite3 "$DB" "select '전표 '||count(*) from rows where tbl='slips'"
