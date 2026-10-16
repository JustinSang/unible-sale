// 사용자 목록·비밀번호 확인(Node 전용: scrypt). AUTH_USERS = [{"id":"sang","name":"상원준","role":"admin","hash":"scrypt$<salt>$<hash>"}, ...]
// 해시는 `node scripts/make_auth_user.mjs <아이디> <이름> <admin|staff>`(비밀번호는 환경변수 PW)로 만든다.
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import type { Role } from '@/lib/auth';

export interface AuthUser { id: string; name: string; role: Role; hash: string }

export function loadUsers(): AuthUser[] {
  try {
    const arr = JSON.parse(process.env.AUTH_USERS || '[]');
    return Array.isArray(arr) ? arr.filter(u => u && u.id && u.hash && (u.role === 'admin' || u.role === 'staff')).map(u => ({ id: String(u.id), name: String(u.name || u.id), role: u.role, hash: String(u.hash) })) : [];
  } catch { return []; }
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(pw, salt, 64).toString('hex')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, salt, hex] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hex) return false;
  const a = scryptSync(pw, salt, 64), b = Buffer.from(hex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
