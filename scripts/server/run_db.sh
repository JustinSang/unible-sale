#!/bin/bash
# launchd가 부르는 로컬 DB 서버 실행기(꺼지면 launchd가 다시 켠다)
cd "$(dirname "$0")/../.." || exit 1
mkdir -p data/live
exec /usr/bin/env python3 scripts/server/local_db.py --port 54321
