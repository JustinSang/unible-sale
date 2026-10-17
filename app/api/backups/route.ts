export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { listBackups, countsOf, createBackup, BACKUP_DIR, BACKUP_NAME, LIVE_DB } from '@/lib/backups';
import { audit } from '@/lib/audit';

// 백업 목록·상태(읽기), 선택한 백업과 «지금 자료» 비교(읽기), 새 백업 만들기. 복원은 여기서 하지 않는다(scripts/server/restore_backup.sh).
export async function GET(req: Request) {
  try {
    const list = listBackups();
    if (!list || !fs.existsSync(LIVE_DB)) return NextResponse.json({ available: false, message: '이 설치에는 로컬 DB 백업이 없습니다(클라우드 DB를 쓰는 설치).' });
    const name = new URL(req.url).searchParams.get('compare');
    if (name) {
      if (!BACKUP_NAME.test(name) || !list.some(b => b.name === name)) return NextResponse.json({ error: '백업 파일을 찾을 수 없습니다.' }, { status: 404 });
      const [bk, live] = await Promise.all([countsOf(path.join(BACKUP_DIR, name), true), countsOf(LIVE_DB)]);
      const tables = [...new Set([...Object.keys(bk), ...Object.keys(live)])].sort();
      return NextResponse.json({ name, rows: tables.map(t => ({ table: t, backup: bk[t] || 0, current: live[t] || 0, diff: (bk[t] || 0) - (live[t] || 0) })) });
    }
    return NextResponse.json({ available: true, backups: list, now: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '백업 조회 실패' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { action } = await req.json().catch(() => ({}));
    if (action !== 'create') return NextResponse.json({ error: 'action은 create 만 지원합니다(복원은 scripts/server/restore_backup.sh).' }, { status: 400 });
    const name = await createBackup();
    const size = fs.statSync(path.join(BACKUP_DIR, name)).size;
    await audit('create', 'backup', name, `수동 백업 생성: ${name} (${Math.round(size / 1024 / 1024 * 10) / 10}MB)`);
    return NextResponse.json({ ok: true, name, size }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || '백업 생성 실패' }, { status: 500 });
  }
}
