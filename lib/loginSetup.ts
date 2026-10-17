// 화면에서 로그인(사용자·비밀번호)을 설정한다 — data/live/app.env 의 AUTH_SECRET·AUTH_USERS 를 쓴다(scripts/server/enable_login.sh 와 같은 파일·같은 모양).
// 비밀번호는 scrypt 해시로만 저장하고 어디에도 기록하지 않는다. 저장 뒤 웹 서버를 다시 시작해야 반영된다(환경변수는 시작할 때 읽는다).
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { LIVE_DIR } from '@/lib/backups';
import { hashPassword, loadUsers } from '@/lib/authUsers';
import type { Role } from '@/lib/auth';

export const ENV_FILE = path.join(LIVE_DIR, 'app.env');
export const ID_RE = /^[A-Za-z0-9_.-]{2,20}$/;
export const NAME_BAD = /['"\\$`\n\r]/; // 셸이 app.env 를 읽을 때 깨지는 문자

export interface InUser { id: string; name: string; role: Role; password?: string }

export function canWriteEnv(): boolean {
  try { fs.mkdirSync(LIVE_DIR, { recursive: true }); fs.accessSync(LIVE_DIR, fs.constants.W_OK); return true; } catch { return false; }
}

// 입력 검증 + 최종 사용자 목록 만들기(없는 비밀번호는 기존 해시 유지). 문제가 있으면 한국어 오류 문장을 던진다.
export function buildUsers(input: InUser[]) {
  if (!Array.isArray(input) || input.length === 0) throw new Error('사용자를 한 명 이상 입력하세요.');
  if (input.length > 30) throw new Error('사용자는 30명까지입니다.');
  const old = new Map(loadUsers().map(u => [u.id.toLowerCase(), u]));
  const seen = new Set<string>();
  const out = input.map(u => {
    const id = String(u.id || '').trim(), name = String(u.name || '').trim();
    if (!ID_RE.test(id)) throw new Error(`아이디 «${id}»는 영문·숫자·_.- 2~20자여야 합니다.`);
    if (seen.has(id.toLowerCase())) throw new Error(`아이디 «${id}»가 겹칩니다.`);
    seen.add(id.toLowerCase());
    if (!name || NAME_BAD.test(name) || name.length > 20) throw new Error(`«${id}»의 이름은 1~20자이고 ' " \\ $ \` 는 쓸 수 없습니다.`);
    if (u.role !== 'admin' && u.role !== 'staff') throw new Error(`«${id}»의 역할은 관리자 또는 직원이어야 합니다.`);
    const prev = old.get(id.toLowerCase());
    if (u.password) {
      if (String(u.password).length < 8) throw new Error(`«${id}»의 비밀번호는 8자 이상이어야 합니다.`);
      return { id, name, role: u.role, hash: hashPassword(String(u.password)) };
    }
    if (!prev) throw new Error(`새 사용자 «${id}»에는 비밀번호가 필요합니다.`);
    return { id, name, role: u.role, hash: prev.hash };
  });
  if (!out.some(u => u.role === 'admin')) throw new Error('관리자(admin)가 한 명 이상 있어야 합니다.');
  return out;
}

const strip = (txt: string) => txt.split('\n').filter(l => !/^(AUTH_SECRET|AUTH_USERS)=/.test(l)).join('\n').replace(/\n+$/, '');

// users=null 이면 로그인을 끈다(두 줄만 제거). 쓰기 전에 app.env.bak_날짜 로 복사해 둔다.
export function writeAuthEnv(users: ReturnType<typeof buildUsers> | null) {
  const cur = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  if (cur) fs.copyFileSync(ENV_FILE, `${ENV_FILE}.bak_${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`);
  const base = strip(cur);
  const secret = process.env.AUTH_SECRET || randomBytes(48).toString('base64'); // 이미 켜져 있으면 같은 비밀키를 써서 다른 사용자의 로그인이 풀리지 않게 한다
  const body = users ? `${base ? base + '\n' : ''}AUTH_SECRET='${secret}'\nAUTH_USERS='${JSON.stringify(users)}'\n` : `${base ? base + '\n' : ''}`;
  const tmp = `${ENV_FILE}.tmp`;
  fs.writeFileSync(tmp, body, { mode: 0o600 }); fs.renameSync(tmp, ENV_FILE); fs.chmodSync(ENV_FILE, 0o600);
}

// 운영(프로덕션, launchd)에서만 스스로 다시 시작한다. 시험·개발 서버는 건드리지 않는다. UNIBLE_RESTART_CMD 로 바꿀 수 있다.
export function scheduleRestart(): 'scheduled' | 'manual' {
  const cmd = process.env.UNIBLE_RESTART_CMD || (process.env.NODE_ENV === 'production' && process.getuid ? `launchctl kickstart -k gui/${process.getuid()}/com.unible.sale.web` : '');
  if (!cmd) return 'manual';
  const p = spawn('/bin/bash', ['-c', `sleep 1.5; ${cmd}`], { detached: true, stdio: 'ignore' });
  p.unref();
  return 'scheduled';
}
