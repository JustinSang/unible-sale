// 로그인 세션(서명 쿠키). Web Crypto만 써서 proxy(미들웨어)와 API 라우트 양쪽에서 같이 쓴다.
// 켜는 법: 환경변수 AUTH_SECRET(긴 무작위 문자열)과 AUTH_USERS(사용자 JSON)를 둘 다 설정 — 하나라도 없으면 로그인 없이 동작한다(기존 방식).
// 지름길: 세션 취소(서버 쪽 무효화) 목록이 없다 — 쿠키 만료(14일) 전에 막으려면 AUTH_SECRET을 바꿔 모두 로그아웃시킨다.
export const SESSION_COOKIE = 'unible_session';
export const SESSION_DAYS = 14;
export type Role = 'admin' | 'staff';
export interface Session { u: string; n: string; r: Role; exp: number }

export const authEnabled = () => !!process.env.AUTH_SECRET && !!process.env.AUTH_USERS;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) => { const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; b.forEach(x => (s += String.fromCharCode(x))); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64url = (s: string) => { const p = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4); return Uint8Array.from(atob(p), c => c.charCodeAt(0)); };
async function key() { return crypto.subtle.importKey('raw', enc.encode(process.env.AUTH_SECRET || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); }

export async function signSession(s: Session): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(s)));
  const sig = await crypto.subtle.sign('HMAC', await key(), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token?: string | null): Promise<Session | null> {
  if (!token || !authEnabled()) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(), fromB64url(sig), enc.encode(body)); // 상수 시간 비교
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session;
    return s.exp > Date.now() / 1000 && (s.r === 'admin' || s.r === 'staff') ? s : null;
  } catch { return null; }
}
