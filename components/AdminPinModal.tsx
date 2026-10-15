'use client';

import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { hashPin } from '@/lib/adminPin';

// 관리자 모드 켜기: PIN이 없으면 새로 정하고(두 번 입력), 있으면 확인한다.
export function AdminPinModal({ pinHash, onSetPin, onUnlocked, onClose }: { pinHash?: string; onSetPin: (hash: string) => Promise<void>; onUnlocked: () => void; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [msg, setMsg] = useState('');
  const creating = !pinHash;
  const submit = async () => {
    if (pin.length < 4) { setMsg('PIN은 4자리 이상으로 입력하세요.'); return; }
    if (creating) {
      if (pin !== pin2) { setMsg('두 번 입력한 PIN이 다릅니다.'); return; }
      await onSetPin(await hashPin(pin)); onUnlocked(); return;
    }
    if ((await hashPin(pin)) === pinHash) onUnlocked(); else { setMsg('PIN이 맞지 않습니다.'); setPin(''); }
  };
  return (
    <div className="fixed inset-0 z-[300] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xs p-5 border border-slate-200">
        <div className="flex items-center justify-between mb-3 border-b pb-2">
          <h3 className="font-bold text-slate-800 flex items-center gap-2"><Lock className="w-4 h-4 text-amber-600" /> 관리자 모드</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="닫기"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-slate-600 mb-3">{creating ? '처음 사용합니다. 관리자 PIN(4자리 이상 숫자)을 정해 주세요. 발송된 전표를 고치거나 지울 때만 씁니다.' : '발송된 전표를 고치거나 지우려면 PIN을 입력하세요.'}</p>
        <input type="password" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN" className="w-full border border-slate-300 rounded p-2 text-sm mb-2" onKeyDown={e => { if (e.key === 'Enter' && !creating) submit(); }} />
        {creating && <input type="password" inputMode="numeric" value={pin2} onChange={e => setPin2(e.target.value)} placeholder="PIN 다시 입력" className="w-full border border-slate-300 rounded p-2 text-sm mb-2" onKeyDown={e => { if (e.key === 'Enter') submit(); }} />}
        {msg && <p className="text-xs text-red-600 mb-2">{msg}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 border border-slate-300 rounded text-sm text-slate-700">취소</button>
          <button onClick={submit} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-sm">{creating ? 'PIN 정하고 켜기' : '켜기'}</button>
        </div>
      </div>
    </div>
  );
}
