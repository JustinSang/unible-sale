'use client';

import React, { useState } from 'react';
import {
  FileText,
  Package,
  Users,
  Truck,
  Database,
  Sliders,
  RefreshCw,
  HardDrive,
  Monitor,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Wallet,
  FileCheck,
  CreditCard,
  Globe
} from 'lucide-react';
import type { OSTheme } from '@/types';
import { RemoteAccessModal } from './RemoteAccessModal';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  osTheme: OSTheme;
  onThemeChange: (theme: OSTheme) => void;
  isSyncing: boolean;
  onManualSync: () => void;
  lastSyncTime: string;
  online: boolean;
  totalProducts: number;
  totalCustomers: number;
  totalReceivables: number;
}

export function Header({
  currentTab,
  onTabChange,
  osTheme,
  onThemeChange,
  isSyncing,
  onManualSync,
  lastSyncTime,
  online,
  totalProducts,
  totalCustomers,
  totalReceivables
}: HeaderProps) {
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState<boolean>(false);
  const tabs = [
    { id: 'slips', label: '전표입력 / 거래원장', icon: FileText, hotkey: 'F2' },
    { id: 'products', label: '품목관리 (1.1만종)', icon: Package, hotkey: 'F3' },
    { id: 'customers', label: '거래처관리', icon: Users, hotkey: 'F4' },
    { id: 'collections', label: '수금 / 지급관리', icon: Wallet, hotkey: 'F5' },
    { id: 'tax_invoices', label: '세금계산서', icon: FileCheck, hotkey: 'F6' },
    { id: 'bills', label: '어음관리', icon: CreditCard, hotkey: 'F7' },
    { id: 'delivery', label: '출고 / 배송관리', icon: Truck, hotkey: 'F8' },
    { id: 'inventory', label: '재고수불부', icon: Database, hotkey: 'F9' },
    { id: 'mdb_tool', label: 'MDB 데이터도구', icon: HardDrive, hotkey: 'F10' },
    { id: 'ini_sync', label: '환경설정 / 동기화', icon: Sliders, hotkey: 'F11' }
  ];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(val);
  };

  const formatTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    } catch {
      return '12:00:00';
    }
  };

  // Modern Windows Style
  if (osTheme === 'modern-win') {
    return (
      <>
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        {/* Top brand & control row */}
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white px-3 py-1.5 rounded-lg font-black text-lg tracking-wider shadow-sm flex items-center gap-1.5 border border-blue-600/50">
              <span className="text-amber-300 font-extrabold text-xl tracking-tight">UNIBLE</span>
              <span className="text-white font-bold text-sm bg-blue-950/60 px-1.5 py-0.5 rounded tracking-widest">SALE</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-800 text-base leading-tight tracking-tight">
                  동산화스너 UNIBLE SALE 클라우드 ERP
                </h1>
                <span className="text-[11px] bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-2 py-0.5 rounded-full shadow-2xs">
                  Enterprise Cloud
                </span>
              </div>
              <p className="text-xs text-slate-500">
                볼트 &middot; 너트 &middot; 화스너 통합 재고 &middot; 다중 현장 전표 관리 시스템
              </p>
            </div>
          </div>

          {/* Metrics summary */}
          <div className="hidden lg:flex items-center gap-4 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400">품목수:</span>{' '}
              <strong className="text-slate-700 font-mono">{totalProducts}개</strong>
            </div>
            <div className="w-px h-3 bg-slate-300" />
            <div>
              <span className="text-slate-400">거래처:</span>{' '}
              <strong className="text-slate-700 font-mono">{totalCustomers}곳</strong>
            </div>
            <div className="w-px h-3 bg-slate-300" />
            <div>
              <span className="text-slate-400">외상미수 총액:</span>{' '}
              <strong className="text-rose-600 font-mono font-bold">{formatCurrency(totalReceivables)}</strong>
            </div>
          </div>

          {/* Sync & Remote Access & Theme controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRemoteModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
              title="스마트폰, 외부 컴퓨터 인터넷 접속 주소 및 QR코드 확인"
            >
              <Globe className="w-3.5 h-3.5 text-amber-300" />
              <span>인터넷 접속</span>
            </button>

            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 active:scale-95 transition-all disabled:opacity-50"
              title="UNIBLE SALE 데이터 즉시 동기화"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
              <span>{isSyncing ? '동기화 중...' : '즉시 동기화'}</span>
            </button>

            <div className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-slate-100 text-slate-600">
              {online ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              )}
              <span>{online ? '온라인' : '오프라인'}</span>
              <span suppressHydrationWarning className="text-slate-400 font-mono">({formatTime(lastSyncTime)})</span>
            </div>

            {/* Theme switcher */}
            <div className="flex items-center border border-slate-200 rounded-md p-0.5 bg-slate-100 text-xs">
              <button
                onClick={() => onThemeChange('modern-win')}
                className="px-2 py-1 rounded flex items-center gap-1 bg-white shadow-xs text-blue-600 font-bold"
                title="모던 윈도우 스타일"
              >
                <Monitor className="w-3 h-3" /> Modern
              </button>
              <button
                onClick={() => onThemeChange('macos')}
                className="px-2 py-1 rounded flex items-center gap-1 text-slate-500 hover:text-slate-800"
                title="macOS 스타일"
              >
                <Laptop className="w-3 h-3" /> Mac
              </button>
              <button
                onClick={() => onThemeChange('winxp-retro')}
                className="px-2 py-1 rounded flex items-center gap-1 text-slate-500 hover:text-slate-800"
                title="클래식 머니플러스 WinXP 스타일"
              >
                XP
              </button>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="max-w-7xl mx-auto px-4 flex space-x-1 border-t border-slate-100 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 py-2.5 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                <span className="text-[10px] font-mono opacity-50 px-1 py-0.2 bg-slate-200 rounded">
                  {tab.hotkey}
                </span>
              </button>
            );
          })}
        </nav>
      </header>
      <RemoteAccessModal isOpen={isRemoteModalOpen} onClose={() => setIsRemoteModalOpen(false)} />
    </>
  );
}

  // macOS Style
  if (osTheme === 'macos') {
    return (
      <>
        <header className="bg-white/90 backdrop-blur-md border-b border-neutral-200 sticky top-0 z-30 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
            {/* macOS window traffic lights */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 mr-2">
                <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e] inline-block shadow-xs" />
                <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] inline-block shadow-xs" />
                <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] inline-block shadow-xs" />
              </div>
              <h1 className="font-semibold text-neutral-800 text-sm tracking-tight flex items-center gap-1.5">
                <span className="font-bold text-blue-700">UNIBLE SALE ERP</span>
                <span className="text-neutral-400 font-normal">&mdash; 동산화스너 물류본부</span>
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRemoteModalOpen(true)}
                className="px-2.5 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 font-semibold shadow-2xs cursor-pointer"
                title="스마트폰, 외부 컴퓨터 인터넷 접속 주소 및 QR코드 확인"
              >
                <Globe className="w-3 h-3 text-amber-300" />
                <span>인터넷접속</span>
              </button>
              <button
                onClick={onManualSync}
                className="px-2.5 py-1 text-xs rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center gap-1 border border-neutral-300 shadow-2xs"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-500' : ''}`} />
                <span>동기화 ({formatTime(lastSyncTime)})</span>
              </button>
              <div className="flex bg-neutral-200 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => onThemeChange('modern-win')}
                  className="px-2 py-0.5 rounded text-neutral-600 hover:text-black"
                >
                  Modern
                </button>
                <button
                  onClick={() => onThemeChange('macos')}
                  className="px-2 py-0.5 rounded bg-white shadow-2xs text-black font-semibold"
                >
                  macOS
                </button>
                <button
                  onClick={() => onThemeChange('winxp-retro')}
                  className="px-2 py-0.5 rounded text-neutral-600 hover:text-black"
                >
                  WinXP
                </button>
              </div>
            </div>
          </div>

          {/* macOS segmented bar tabs */}
          <div className="max-w-7xl mx-auto px-4 pb-2 pt-1 flex items-center justify-start overflow-x-auto gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
                    isActive
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </header>
        <RemoteAccessModal isOpen={isRemoteModalOpen} onClose={() => setIsRemoteModalOpen(false)} />
      </>
    );
  }

  // Windows XP Retro Style (FarPoint Spread 3.0 era)
  return (
    <>
      <header className="bg-[#d4d0c8] border-b-2 border-white shadow-xs select-none">
        {/* XP Window Titlebar */}
        <div className="bg-gradient-to-r from-[#0055ea] via-[#0058ee] to-[#3096ff] text-white px-3 py-1 flex items-center justify-between text-xs font-bold border-b border-[#003b9e]">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-400 rounded-sm flex items-center justify-center text-[10px] text-blue-900 font-black">
              UB
            </div>
            <span>[Enterprise Cloud] UNIBLE SALE ERP - 동산화스너 v3.5.0</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-blue-100 font-normal mr-2">
              동기화: {formatTime(lastSyncTime)} ({online ? '온라인 상태' : '로컬 단독모드'})
            </span>
            <div className="flex items-center border border-white/50 rounded bg-blue-900/40 text-[10px] px-1">
              <button
                onClick={() => onThemeChange('modern-win')}
                className="px-1 py-0.5 hover:bg-blue-800"
              >
                현대식
              </button>
              <span className="text-blue-300">|</span>
              <button
                onClick={() => onThemeChange('winxp-retro')}
                className="px-1 py-0.5 font-bold text-yellow-300"
              >
                XP레트로
              </button>
            </div>
          </div>
        </div>

        {/* Classic Menu Bar */}
        <div className="bg-[#ece9d8] border-b border-[#919b9c] px-2 py-0.5 text-xs flex gap-4 text-black font-sans">
          <span className="hover:bg-blue-600 hover:text-white px-1.5 py-0.5 cursor-pointer">파일(F)</span>
          <span className="hover:bg-blue-600 hover:text-white px-1.5 py-0.5 cursor-pointer">전표관리(S)</span>
          <span className="hover:bg-blue-600 hover:text-white px-1.5 py-0.5 cursor-pointer">기초원장(B)</span>
          <span className="hover:bg-blue-600 hover:text-white px-1.5 py-0.5 cursor-pointer">재고수불(I)</span>
          <span className="hover:bg-blue-600 hover:text-white px-1.5 py-0.5 cursor-pointer">인쇄출력(P)</span>
          <span className="hover:bg-blue-600 hover:text-white px-1.5 py-0.5 cursor-pointer">도구/환경(T)</span>
        </div>

        {/* Classic Button Toolbar */}
        <div className="bg-[#d4d0c8] p-1.5 flex flex-wrap items-center gap-1 border-b border-[#808080]">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-sans transition-none ${
                  isActive
                    ? 'bg-[#ece9d8] border-2 border-t-[#404040] border-l-[#404040] border-r-white border-b-white font-bold text-blue-900 shadow-inner'
                    : 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white text-black'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-slate-700" />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setIsRemoteModalOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white font-bold text-blue-900 font-sans cursor-pointer"
              title="원격 인터넷 접속 주소"
            >
              <Globe className="w-3 h-3 text-blue-700" />
              <span>원격인터넷접속(R)</span>
            </button>
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white font-sans"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>즉시동기화</span>
            </button>
          </div>
        </div>
      </header>
      <RemoteAccessModal isOpen={isRemoteModalOpen} onClose={() => setIsRemoteModalOpen(false)} />
    </>
  );
}
