// app/(auth)/login/page.tsx
'use client'

import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-300">
      {/* Windows XP 스타일 다이얼로그 박스 */}
      <div className="dialog-box border-2 border-white border-t-slate-500 border-b-slate-500 border-l-slate-500 border-r-slate-500 p-4 bg-gray-300">
        <div className="dialog-title bg-gradient-to-b from-blue-800 to-cyan-600 text-white font-bold px-2 py-1 mb-2">로그인</div>
        <label className="block text-sm font-medium text-gray-700">사용자 이름:</label>
        <input
          type="text"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        <label className="block text-sm font-medium text-gray-700 mt-2">암호:</label>
        <input
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
        <div className="button-row flex justify-between mt-4">
          <button className="btn-xp bg-gray-100 border border-slate-400 rounded px-4 py-2 hover:bg-gray-200 active:border-slate-700">확인 Enter</button>
          <button className="btn-xp bg-gray-100 border border-slate-400 rounded px-4 py-2 hover:bg-gray-200 active:border-slate-700">취소 Esc</button>
        </div>
      </div>
    </div>
  );
}

