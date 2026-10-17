'use client';

// 로그인 설정(사용자·비밀번호) 화면. 저장하면 설정 파일을 쓰고 웹이 스스로 다시 시작한 뒤 로그인 화면으로 이동한다(/api/auth-setup).
// 로그인이 꺼져 있을 때의 최초 설정은 이 컴퓨터(localhost)에서 연 화면에서만 된다.
import React, { useEffect, useState } from 'react';

interface Row { id: string; name: string; role: 'admin' | 'staff'; password: string; isNew: boolean }
interface State { enabled: boolean; canManage: boolean; reason: string; users: { id: string; name: string; role: 'admin' | 'staff' }[] }

export function LoginSettingsPanel() {
  const [st, setSt] = useState<State | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const d: State = await fetch('/api/auth-setup').then(r => r.json());
      setSt(d);
      setRows(d.users.length ? d.users.map(u => ({ ...u, password: '', isNew: false })) : [{ id: '', name: '', role: 'admin', password: '', isNew: true }]);
    } catch { setMsg('오류: 상태를 읽지 못했습니다.'); }
  };
  useEffect(() => { load(); }, []);

  const set = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  // 다시 시작이 끝날 때까지 기다린 뒤 이동한다(꺼졌다 켜지는 동안 응답이 끊긴다). 서버가 응답하면(200, 로그인이 켜져 있으면 401) 끝난 것이다.
  // 로그인이 꺼진 상태면 메인 화면(/)으로, 켜진 상태면 로그인 화면으로 간다.
  const waitAndGo = async () => {
    setMsg('웹을 다시 시작하는 중입니다… 잠시 뒤 자동으로 이동합니다.');
    await new Promise(r => setTimeout(r, 3500));
    let target = '/login';
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        if (r.status === 200 || r.status === 401) { const d = await r.json().catch(() => ({})); if (d && d.enabled === false) target = '/'; break; }
      } catch { /* 아직 꺼진 중 */ }
      await new Promise(r => setTimeout(r, 1500));
    }
    window.location.href = target;
  };

  const call = async (body: object, ok: string) => {
    setBusy(true); setMsg('');
    try {
      const r = await fetch('/api/auth-setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || String(r.status));
      if (d.restart === 'scheduled') { await waitAndGo(); return; }
      setMsg(`${ok} 이 서버는 자동으로 다시 시작하지 않는 환경이라, 서버를 직접 다시 시작해야 반영됩니다.`);
      await load();
    } catch (e: any) { setMsg(`오류: ${e.message || e}`); }
    setBusy(false);
  };

  const save = () => {
    const turningOn = !st?.enabled;
    if (!confirm(turningOn
      ? '로그인을 켭니다. 저장하면 웹이 다시 시작되고, 이 화면도 바로 로그인 화면으로 바뀝니다. 방금 입력한 관리자 아이디와 비밀번호를 꼭 기억하세요. 계속할까요?'
      : '사용자 설정을 저장합니다. 웹이 다시 시작되고 로그인 화면으로 이동합니다. 계속할까요?')) return;
    call({ action: 'save', users: rows.map(r => ({ id: r.id, name: r.name, role: r.role, password: r.password || undefined })) }, '저장했습니다.');
  };
  const disable = () => { if (confirm('로그인을 끕니다. 끄면 이 컴퓨터와 같은 네트워크에서 접속하는 누구나 모든 기능을 쓸 수 있습니다. 계속할까요?')) call({ action: 'disable' }, '로그인을 껐습니다.'); };

  if (!st) return null;
  return (
    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs text-xs space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-xs text-slate-800">로그인·사용자 설정</h3>
        <span className={`px-2 py-0.5 rounded-full font-bold ${st.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{st.enabled ? '로그인 켜짐' : '로그인 꺼짐'}</span>
      </div>
      {!st.enabled && <p className="text-rose-600">지금은 접속할 수 있는 누구나 모든 기능(삭제 포함)을 쓸 수 있습니다. 같은 와이파이·Tailscale에서도 열려 있으니, 인터넷·여러 사람이 쓰기 전에 켜세요.</p>}
      {!st.canManage ? <p className="text-slate-600">{st.reason}</p> : <>
        <p className="text-slate-500">관리자(admin)는 모든 기능, 직원(staff)은 삭제·미동 전환·설정 변경·변경 이력 조회가 막힙니다. 기존 사용자의 비밀번호 칸을 비워 두면 비밀번호는 그대로입니다. 비밀번호는 해시로만 저장되고 화면·기록에 남지 않습니다.</p>
        <table className="w-full border-collapse">
          <thead><tr className="bg-slate-50 text-slate-500 border-b"><th className="p-1 text-left">아이디</th><th className="p-1 text-left">이름</th><th className="p-1">역할</th><th className="p-1 text-left">{st.enabled ? '새 비밀번호(바꿀 때만)' : '비밀번호(8자 이상)'}</th><th className="p-1 w-10" /></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="p-1"><input value={r.id} disabled={!r.isNew} onChange={e => set(i, { id: e.target.value })} placeholder="영문·숫자 2~20자" className="w-full border border-slate-300 rounded px-1.5 py-1 disabled:bg-slate-100 font-mono" /></td>
              <td className="p-1"><input value={r.name} onChange={e => set(i, { name: e.target.value })} placeholder="화면에 표시될 이름" className="w-full border border-slate-300 rounded px-1.5 py-1" /></td>
              <td className="p-1 text-center"><select value={r.role} onChange={e => set(i, { role: e.target.value as 'admin' | 'staff' })} className="border border-slate-300 rounded px-1 py-1"><option value="admin">관리자</option><option value="staff">직원</option></select></td>
              <td className="p-1"><input type="password" autoComplete="new-password" value={r.password} onChange={e => set(i, { password: e.target.value })} placeholder={r.isNew ? '8자 이상' : '그대로 두려면 비워 두기'} className="w-full border border-slate-300 rounded px-1.5 py-1" /></td>
              <td className="p-1 text-center"><button type="button" onClick={() => setRows(rs => rs.filter((_, k) => k !== i))} disabled={rows.length <= 1} className="text-rose-600 hover:underline disabled:opacity-30">삭제</button></td>
            </tr>))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setRows(rs => [...rs, { id: '', name: '', role: 'staff', password: '', isNew: true }])} className="border border-slate-300 rounded px-2 py-1 hover:bg-slate-50">+ 사용자 추가</button>
          <button type="button" onClick={save} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-1.5 font-bold disabled:opacity-50">{st.enabled ? '저장(웹 다시 시작)' : '저장하고 로그인 켜기'}</button>
          {st.enabled && <button type="button" onClick={disable} disabled={busy} className="ml-auto border border-rose-300 text-rose-600 rounded px-3 py-1 hover:bg-rose-50">로그인 끄기</button>}
        </div>
      </>}
      {msg && <p className={msg.startsWith('오류') ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>{msg}</p>}
    </div>
  );
}
