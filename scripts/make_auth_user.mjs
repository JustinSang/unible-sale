// 로그인 사용자 한 줄(JSON)을 만든다. 비밀번호는 명령줄에 쓰지 않고 환경변수 PW로 넘긴다(셸 기록에 남지 않게).
// 사용: read -s PW; export PW; node scripts/make_auth_user.mjs sang 상원준 admin
//   → 출력된 JSON들을 배열로 묶어 환경변수 AUTH_USERS 에 넣는다. AUTH_SECRET 은 `openssl rand -base64 48` 로 만든다.
import { scryptSync, randomBytes } from 'crypto';
const [id, name, role] = process.argv.slice(2);
const pw = process.env.PW || '';
if (!id || !name || !['admin', 'staff'].includes(role) || pw.length < 8) { console.error('사용: PW=<8자 이상> node scripts/make_auth_user.mjs <아이디> <이름> <admin|staff>'); process.exit(1); }
const salt = randomBytes(16).toString('hex');
console.log(JSON.stringify({ id, name, role, hash: `scrypt$${salt}$${scryptSync(pw, salt, 64).toString('hex')}` }));
