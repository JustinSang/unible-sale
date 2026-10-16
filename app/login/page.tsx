'use client';

import React, { useState } from 'react';
import { BRAND } from '@/lib/brand';

// 로그인 화면. 로그인 기능(AUTH_SECRET·AUTH_USERS)이 꺼진 서버에서는 접속해도 바로 첫 화면으로 돌려보낸다.
export default function LoginPage() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, password }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { window.location.href = '/'; return; }
      if (res.status === 400) { window.location.href = '/'; return; } // 로그인 기능이 꺼져 있음
      setErr(data.error || '로그인하지 못했습니다.');
    } catch { setErr('서버에 연결하지 못했습니다.'); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-xl shadow border border-slate-200 p-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800">UNIBLE SALE</h1>
          <p className="text-xs text-slate-500">{BRAND.company} 클라우드 ERP — 로그인</p>
        </div>
        <label className="block text-xs font-semibold text-slate-700">아이디
          <input autoFocus autoComplete="username" value={id} onChange={e => setId(e.target.value)} className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs font-semibold text-slate-700">비밀번호
          <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </label>
        {err && <p className="text-xs text-red-600" role="alert">{err}</p>}
        <button disabled={busy || !id || !password} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded py-2 text-sm font-bold">{busy ? '확인 중…' : '로그인'}</button>
      </form>
    </div>
  );
}
