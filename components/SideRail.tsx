'use client';

// 오른쪽 아이콘 줄(아이콘바). 이카운트 «apps» 줄의 기능 중 이 앱 안에서 동작하는 것만 넣었다 —
// 메뉴 검색 · 새 창 · 즐겨찾기 · 최근 작업 타임라인(변경 이력) · 전자노트 · 도움말(단축키) · 사용자 · 줄 설정.
// 서버·외부 서비스가 필요한 쪽지·메신저·문자·웹메일·원격지원·UserPay는 넣지 않았다.
// 근거: docs/analysis_rea/ecount/ecount_계산규칙_아이콘바_REA분석_2026-10-17.md
// 지름길: 즐겨찾기·전자노트·줄 설정은 이 브라우저(localStorage)에만 저장한다 — 여러 PC 공유가 필요하면 서버 저장으로 바꿀 것.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ExternalLink, Star, History, StickyNote, HelpCircle, User, SlidersHorizontal, X } from 'lucide-react';
import { BRAND } from '@/lib/brand';

const TABS: { id: string; label: string; hotkey: string }[] = [
  { id: 'slips', label: '전표입력 / 거래원장', hotkey: 'F2' },
  { id: 'products', label: '품목관리', hotkey: 'F3' },
  { id: 'customers', label: '거래처관리', hotkey: 'F4' },
  { id: 'collections', label: '수금 / 지급관리', hotkey: 'F5' },
  { id: 'tax_invoices', label: '세금계산서', hotkey: 'F6' },
  { id: 'bills', label: '어음관리', hotkey: 'F7' },
  { id: 'delivery', label: '출고 / 배송관리', hotkey: 'F8' },
  { id: 'inventory', label: '재고수불부', hotkey: 'F9' },
  { id: 'mdb_tool', label: 'MDB 데이터도구', hotkey: 'F10' },
  { id: 'ledgers', label: '장부 / 집계표', hotkey: 'F12' },
  ...(BRAND.featureMidong ? [{ id: 'midong', label: '미동 발주내역', hotkey: '' }] : []),
  { id: 'ini_sync', label: '환경설정 / 동기화', hotkey: 'F11' },
];

type PanelId = 'search' | 'fav' | 'timeline' | 'note' | 'help' | 'user' | 'setup';
const ICONS: { id: PanelId | 'newwin'; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'search', label: '메뉴 검색', Icon: Search },
  { id: 'newwin', label: '새 창', Icon: ExternalLink },
  { id: 'fav', label: '즐겨찾기', Icon: Star },
  { id: 'timeline', label: '최근 작업', Icon: History },
  { id: 'note', label: '전자노트', Icon: StickyNote },
  { id: 'help', label: '도움말', Icon: HelpCircle },
  { id: 'user', label: '사용자', Icon: User },
  { id: 'setup', label: '줄 설정', Icon: SlidersHorizontal },
];

const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* 저장 불가(시크릿 창 등)면 무시 */ } };

interface AuditRow { id: string; at: string; action: string; entity: string; summary: string }

export function SideRail({ currentTab, onTabChange }: { currentTab: string; onTabChange: (tab: string) => void }) {
  const [open, setOpen] = useState<PanelId | null>(null);
  const [query, setQuery] = useState('');
  const [favs, setFavs] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [auditErr, setAuditErr] = useState('');
  const [me, setMe] = useState<{ enabled: boolean; loggedIn?: boolean; name?: string; role?: string } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try { setFavs(JSON.parse(read('unible.rail.fav') || '[]')); } catch { setFavs([]); }
    try { setHidden(JSON.parse(read('unible.rail.hidden') || '[]')); } catch { setHidden([]); }
    setNote(read('unible.rail.note') || '');
  }, []);

  useEffect(() => {
    if (open === 'timeline') {
      setAuditErr('');
      fetch('/api/audit?limit=60').then(r => r.json()).then(d => setAudit(Array.isArray(d) ? d : [])).catch(() => setAuditErr('변경 이력을 불러오지 못했습니다.'));
    }
    if (open === 'user' && !me) fetch('/api/auth/me').then(r => r.json()).then(setMe).catch(() => setMe({ enabled: false }));
  }, [open, me]);

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id];
    setFavs(next); write('unible.rail.fav', JSON.stringify(next));
  };
  const toggleHidden = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter(x => x !== id) : [...hidden, id];
    setHidden(next); write('unible.rail.hidden', JSON.stringify(next));
  };
  const onNote = (v: string) => {
    setNote(v);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => write('unible.rail.note', v), 400);
  };
  const go = (id: string) => { onTabChange(id); setOpen(null); setQuery(''); };

  const found = useMemo(() => {
    const q = query.trim().replace(/\s/g, '').toLowerCase();
    return TABS.filter(t => !q || t.label.replace(/\s/g, '').toLowerCase().includes(q) || t.hotkey.toLowerCase() === q);
  }, [query]);

  const byDate = useMemo(() => {
    const m = new Map<string, AuditRow[]>();
    (audit || []).forEach(a => { const d = (a.at || '').slice(0, 10); m.set(d, [...(m.get(d) || []), a]); });
    return [...m.entries()];
  }, [audit]);

  const visible = ICONS.filter(i => i.id === 'setup' || !hidden.includes(i.id));
  const curTab = TABS.find(t => t.id === currentTab);

  return (
    <div className="print:hidden fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-start" data-testid="side-rail">
      {open && (
        <div className="mr-1 w-80 max-h-[80vh] overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-xl text-slate-800 text-sm">
          <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-50 sticky top-0">
            <b>{ICONS.find(i => i.id === open)?.label}</b>
            <button onClick={() => setOpen(null)} aria-label="닫기"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-3">
            {open === 'search' && (
              <>
                <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="메뉴 이름 또는 F키"
                  onKeyDown={e => { if (e.key === 'Enter' && found[0]) go(found[0].id); }}
                  className="w-full border rounded px-2 py-1.5 mb-2" />
                {found.length === 0 && <p className="text-slate-500">일치하는 메뉴가 없습니다.</p>}
                {found.map(t => (
                  <button key={t.id} onClick={() => go(t.id)} className="w-full text-left px-2 py-1.5 rounded hover:bg-blue-50 flex justify-between">
                    <span>{t.label}</span><span className="text-xs text-slate-400">{t.hotkey}</span>
                  </button>
                ))}
              </>
            )}
            {open === 'fav' && (
              <>
                {curTab && (
                  <button onClick={() => toggleFav(curTab.id)} className="mb-2 w-full text-left px-2 py-1.5 rounded border border-amber-300 bg-amber-50">
                    {favs.includes(curTab.id) ? '★ 현재 화면을 즐겨찾기에서 빼기' : '☆ 현재 화면을 즐겨찾기에 넣기'} — {curTab.label}
                  </button>
                )}
                {favs.length === 0 && <p className="text-slate-500">즐겨찾기가 없습니다. 위 버튼으로 현재 화면을 넣어 보세요.</p>}
                {favs.map(id => {
                  const t = TABS.find(x => x.id === id); if (!t) return null;
                  return (
                    <div key={id} className="flex items-center gap-1">
                      <button onClick={() => go(id)} className="flex-1 text-left px-2 py-1.5 rounded hover:bg-blue-50">{t.label}</button>
                      <button onClick={() => toggleFav(id)} className="text-xs text-slate-400 hover:text-red-500 px-1" aria-label="즐겨찾기 삭제">삭제</button>
                    </div>
                  );
                })}
              </>
            )}
            {open === 'timeline' && (
              <>
                {auditErr && <p className="text-red-600">{auditErr}</p>}
                {!audit && !auditErr && <p className="text-slate-500">불러오는 중…</p>}
                {audit && audit.length === 0 && <p className="text-slate-500">기록이 없습니다.</p>}
                {byDate.map(([d, rows]) => (
                  <div key={d} className="mb-2">
                    <div className="text-xs font-bold text-slate-500 mb-1">{d}</div>
                    {rows.map(r => (
                      <div key={r.id} className="text-xs py-0.5 border-b border-slate-100">
                        <span className="text-slate-400">{(r.at || '').slice(11, 16)} </span>{r.summary}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
            {open === 'note' && (
              <>
                <textarea value={note} onChange={e => onNote(e.target.value)} rows={12} placeholder="자유롭게 적어 두세요. 자동 저장됩니다."
                  className="w-full border rounded p-2 text-sm" />
                <p className="text-xs text-slate-400 mt-1">이 컴퓨터의 브라우저에만 저장됩니다.</p>
              </>
            )}
            {open === 'help' && (
              <>
                <b className="block mb-1">화면 이동 단축키</b>
                {TABS.filter(t => t.hotkey).map(t => (
                  <div key={t.id} className="flex justify-between py-0.5"><span>{t.label}</span><kbd className="text-xs bg-slate-100 border rounded px-1">{t.hotkey}</kbd></div>
                ))}
                <p className="text-xs text-slate-400 mt-2">전표입력 안의 단축키(행 추가 Ins, 저장 F4, 할인율 F4, 품목 검색 F2)는 해당 화면에 표시돼 있습니다.</p>
              </>
            )}
            {open === 'user' && (
              <>
                {!me && <p className="text-slate-500">불러오는 중…</p>}
                {me && !me.enabled && <p className="text-slate-600">로그인 기능이 꺼져 있습니다(이 컴퓨터 전용 모드).</p>}
                {me && me.enabled && me.loggedIn && (
                  <>
                    <p className="mb-2">{me.name} <span className="text-xs text-slate-400">({me.role})</span></p>
                    <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}
                      className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50">로그아웃</button>
                  </>
                )}
                {me && me.enabled && !me.loggedIn && <p className="text-slate-600">로그인되어 있지 않습니다.</p>}
              </>
            )}
            {open === 'setup' && (
              <>
                <p className="text-xs text-slate-500 mb-2">줄에 보일 아이콘을 고릅니다.</p>
                {ICONS.filter(i => i.id !== 'setup').map(i => (
                  <label key={i.id} className="flex items-center gap-2 py-0.5">
                    <input type="checkbox" checked={!hidden.includes(i.id)} onChange={() => toggleHidden(i.id)} />{i.label}
                  </label>
                ))}
              </>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1 rounded-l-lg border border-r-0 border-slate-300 bg-white/95 shadow-lg p-1">
        {visible.map(({ id, label, Icon }) => (
          <button key={id} title={label} aria-label={label}
            onClick={() => { if (id === 'newwin') window.open(window.location.href, '_blank'); else setOpen(open === id ? null : id as PanelId); }}
            className={`w-9 h-9 flex items-center justify-center rounded hover:bg-blue-50 ${open === id ? 'bg-blue-100 text-blue-700' : 'text-slate-600'}`}>
            <Icon className="w-5 h-5" />
          </button>
        ))}
      </div>
    </div>
  );
}
