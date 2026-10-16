#!/bin/bash
# 매일 한 번: 로컬 DB 일관된 사본(sqlite 백업 API)을 만들어 구글 드라이브(개발 서버 스토리지)에 올린다. 복사만 한다(지우지 않음).
cd "$(dirname "$0")/../.." || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
TS=$(date +%Y%m%d_%H%M%S); OUT="data/live/backups/unible_${TS}_daily.sqlite"
mkdir -p data/live/backups
sqlite3 data/live/unible_live.sqlite ".backup '$OUT'" || { echo "백업 실패"; exit 1; }
ls -t data/live/backups/unible_*.sqlite | tail -n +60 | xargs rm -f   # 로컬 백업은 최근 60개만
# 개발 서버 스토리지(gdrive_unible:)를 먼저 시도하고, 인증이 풀려 있으면(2026-10-16 실측: unauthorized_client) 기존 백업 계정(gdrive:unible_backup)으로 대신 올린다.
if rclone lsd gdrive_unible: --max-depth 0 >/dev/null 2>&1; then DEST="gdrive_unible:UNIBLE_PROJECTS/03_unible_sale/live_db_backups"; else DEST="gdrive:unible_backup/dongsan_sale/live_db_backups"; echo "[경고] gdrive_unible: 인증 실패 → $DEST 로 대신 올립니다(rclone config reconnect gdrive_unible: 필요)"; fi
rclone copy "$OUT" "$DEST" --retries 3 && echo "드라이브 업로드 완료: $OUT → $DEST ($(du -h "$OUT" | cut -f1))"
