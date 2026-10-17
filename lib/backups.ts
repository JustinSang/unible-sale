// 로컬 DB 백업 도구(읽기·새 백업 만들기). 복원은 웹에서 하지 않는다 — scripts/server/restore_backup.sh 로만(웹 버튼 하나로 운영 자료를 덮어쓰는 일을 막기 위해).
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
const run = promisify(execFile);

export const LIVE_DIR = process.env.UNIBLE_LIVE_DIR || path.join(process.cwd(), 'data', 'live');
export const LIVE_DB = path.join(LIVE_DIR, 'unible_live.sqlite');
export const BACKUP_DIR = path.join(LIVE_DIR, 'backups');
export const BACKUP_NAME = /^unible_\d{8}_\d{6}[A-Za-z0-9_]*\.sqlite$/; // 경로 조작 방지: 이 모양의 파일 이름만 다룬다

export const kindOf = (name: string) => /_start\./.test(name) ? '시작 때' : /_daily\./.test(name) ? '매일 03:10' : /_manual\./.test(name) ? '수동' : /_before_restore\./.test(name) ? '복원 직전' : '6시간마다';

export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  return fs.readdirSync(BACKUP_DIR).filter(n => BACKUP_NAME.test(n)).map(n => {
    const st = fs.statSync(path.join(BACKUP_DIR, n));
    return { name: n, size: st.size, mtime: st.mtime.toISOString(), kind: kindOf(n) };
  }).sort((a, b) => b.mtime.localeCompare(a.mtime));
}

// 표별 행 수. 파일이 깨졌으면 오류를 던진다.
// 백업 파일은 정지된 파일이라 immutable URI로, 지금 DB(서버가 쓰는 중)는 일반으로 연다 — 둘 다 읽기만 한다.
export async function countsOf(file: string, isBackup = false): Promise<Record<string, number>> {
  const target = isBackup ? `file:${file}?immutable=1` : file;
  const { stdout } = await run('sqlite3', ['-separator', '|', target, 'select tbl, count(*) from rows group by tbl'], { timeout: 20000 });
  const out: Record<string, number> = {};
  stdout.trim().split('\n').filter(Boolean).forEach(l => { const [t, c] = l.split('|'); out[t] = Number(c); });
  return out;
}

export async function createBackup(): Promise<string> {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const d = new Date(); const p = (n: number) => String(n).padStart(2, '0');
  const name = `unible_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}_manual.sqlite`;
  const out = path.join(BACKUP_DIR, name);
  await run('sqlite3', [LIVE_DB, `.backup '${out}'`], { timeout: 60000 }); // SQLite 백업 API — 쓰는 중이어도 일관된 사본
  return name;
}
