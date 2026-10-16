#!/bin/bash
# 매일 한 번: 로컬 DB 일관된 사본(sqlite 백업 API)을 만들어 구글 드라이브(개발 서버 스토리지)에 올린다. 복사만 한다(지우지 않음).
cd "$(dirname "$0")/../.." || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
TS=$(date +%Y%m%d_%H%M%S); OUT="data/live/backups/unible_${TS}_daily.sqlite"
mkdir -p data/live/backups
sqlite3 data/live/unible_live.sqlite ".backup '$OUT'" || { echo "백업 실패"; exit 1; }
ls -t data/live/backups/unible_*.sqlite | tail -n +60 | xargs rm -f   # 로컬 백업은 최근 60개만
rclone copy "$OUT" "gdrive_unible:UNIBLE_PROJECTS/03_unible_sale/live_db_backups" --retries 3 && echo "드라이브 업로드 완료: $OUT ($(du -h "$OUT" | cut -f1))"
