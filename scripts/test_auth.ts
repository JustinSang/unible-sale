// 로그인 세션·비밀번호 단위 시험. 실행: npx tsx scripts/test_auth.ts (전부 PASS여야 한다)
import { signSession, verifySession, authEnabled } from '../lib/auth';
import { hashPassword, verifyPassword, loadUsers } from '../lib/authUsers';
const eq = (n: string, a: unknown, b: unknown) => { const ok = JSON.stringify(a) === JSON.stringify(b); console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `${JSON.stringify(a)} != ${JSON.stringify(b)}`); if (!ok) process.exitCode = 1; };
(async () => {
  eq('꺼짐(환경변수 없음)', authEnabled(), false);
  process.env.AUTH_SECRET = 'x'.repeat(40); process.env.AUTH_USERS = JSON.stringify([{ id: 'a', name: '관리', role: 'admin', hash: hashPassword('pw-12345678') }, { id: 'b', name: '직원', role: 'staff', hash: hashPassword('staffpass1') }, { id: 'bad', role: 'root', hash: 'x' }]);
  eq('켜짐', authEnabled(), true);
  eq('사용자 2명(잘못된 역할 제외)', loadUsers().map(u => u.id), ['a', 'b']);
  const u = loadUsers()[0];
  eq('비번 맞음', verifyPassword('pw-12345678', u.hash), true);
  eq('비번 틀림', verifyPassword('pw-12345679', u.hash), false);
  eq('깨진 해시', verifyPassword('x', 'garbage'), false);
  const exp = Math.floor(Date.now() / 1000) + 100;
  const tok = await signSession({ u: 'a', n: '관리', r: 'admin', exp });
  eq('토큰 확인', (await verifySession(tok))?.u, 'a');
  const [b, s] = tok.split('.');
  const forged = Buffer.from(JSON.stringify({ u: 'a', n: '관리', r: 'admin', exp: exp + 99999 })).toString('base64url') + '.' + s;
  eq('본문 변조 거부', await verifySession(forged), null);
  eq('서명 변조 거부', await verifySession(b + '.' + s.slice(0, -2) + 'AA'), null);
  eq('역할 승격 거부', await verifySession(Buffer.from(JSON.stringify({ u: 'b', n: '직원', r: 'admin', exp })).toString('base64url') + '.' + s), null);
  eq('만료 거부', await verifySession(await signSession({ u: 'a', n: 'x', r: 'admin', exp: Math.floor(Date.now() / 1000) - 5 })), null);
  eq('쓰레기 토큰', await verifySession('abc'), null);
  eq('없음', await verifySession(undefined), null);
  process.env.AUTH_SECRET = 'y'.repeat(40);
  eq('다른 비밀키로는 거부', await verifySession(tok), null);
})();
