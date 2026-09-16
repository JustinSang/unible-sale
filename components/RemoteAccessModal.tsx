'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Wifi,
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  X,
  ExternalLink,
  Smartphone,
  Server,
  Share2
} from 'lucide-react';

interface RemoteAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NetworkInfo {
  localIp: string;
  localUrl: string;
  tailscaleIp: string | null;
  tailscaleUrl: string | null;
  port: number;
  hostname: string;
}

export function RemoteAccessModal({ isOpen, onClose }: RemoteAccessModalProps) {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'wifi' | 'tailscale' | 'public'>('wifi');

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/network-info')
      .then(res => res.json())
      .then(data => setNetworkInfo(data))
      .catch(() => {
        setNetworkInfo({
          localIp: '192.168.219.102',
          localUrl: 'http://192.168.219.102:3000',
          tailscaleIp: '100.64.56.95',
          tailscaleUrl: 'http://100.64.56.95:3000',
          port: 3000,
          hostname: 'Dongsan-Mac'
        });
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const localUrl = networkInfo?.localUrl || 'http://192.168.219.102:3000';
  const tailscaleUrl = networkInfo?.tailscaleUrl || 'http://100.64.56.95:3000';

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const shareText = `[동산화스너 UNIBLE SALE 클라우드 ERP 접속 안내]
사내 Wi-Fi 접속: ${localUrl}
원격 Tailscale 접속: ${tailscaleUrl}
스마트폰 또는 PC 브라우저(크롬, 사파리)에서 바로 접속하세요.`;

  const currentQrTarget = activeTab === 'wifi' ? localUrl : activeTab === 'tailscale' ? tailscaleUrl : localUrl;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(currentQrTarget)}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md">
              <Globe className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">
                UNIBLE SALE 실시간 원격 & 인터넷 접속 센터
              </h3>
              <p className="text-[11px] text-blue-100">
                아버지 컴퓨터, 스마트폰, 공사현장 어디서나 실시간 접속
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-1 text-xs">
          <button
            onClick={() => setActiveTab('wifi')}
            className={`py-2 px-3 font-bold rounded-t-lg border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'wifi'
                ? 'bg-white border-blue-600 text-blue-700 shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>사내 Wi-Fi / 사무실 PC</span>
          </button>
          <button
            onClick={() => setActiveTab('tailscale')}
            className={`py-2 px-3 font-bold rounded-t-lg border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'tailscale'
                ? 'bg-white border-blue-600 text-blue-700 shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tailscale 원격보안망</span>
          </button>
          <button
            onClick={() => setActiveTab('public')}
            className={`py-2 px-3 font-bold rounded-t-lg border-b-2 flex items-center gap-1.5 transition-all ${
              activeTab === 'public'
                ? 'bg-white border-blue-600 text-blue-700 shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>외부 공개 터널 (HTTPS)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {activeTab === 'wifi' && (
            <div className="space-y-3">
              <div className="bg-blue-50/80 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Wifi className="w-4 h-4 text-blue-600" />
                    사내 Wi-Fi / 동일 공유기 접속 주소
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    즉시 접속 가능
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  사무실이나 매장의 동일한 Wi-Fi에 연결된 <strong>아버지 컴퓨터, 노트북, 스마트폰</strong>에서 브라우저(크롬, 엣지, 사파리)를 열고 아래 주소를 입력하세요.
                </p>

                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={localUrl}
                    className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded font-mono font-bold text-blue-900 text-sm select-all"
                  />
                  <button
                    onClick={() => handleCopy(localUrl, 'local')}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold flex items-center gap-1 shadow-xs transition-colors shrink-0"
                  >
                    {copiedKey === 'local' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedKey === 'local' ? '복사됨!' : '주소 복사'}</span>
                  </button>
                </div>
              </div>

              {/* QR Code Section */}
              <div className="border border-slate-200 rounded-lg p-3 flex items-center gap-4 bg-slate-50">
                <div className="bg-white p-1.5 rounded-lg border border-slate-300 shadow-2xs shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCodeUrl}
                    alt="스마트폰 접속 QR코드"
                    width={100}
                    height={100}
                    className="rounded"
                  />
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                    <span>스마트폰 카메라로 즉시 스캔</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    스마트폰 기본 카메라로 이 QR코드를 비추면 주소 입력 없이 바로 동산화스너 UNIBLE SALE ERP가 열립니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tailscale' && (
            <div className="space-y-3">
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Tailscale 전용 가상사설 보안망
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-bold">
                    외부/출장지 추천
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  외부 공사현장, 거래처 미팅, 자택 등 <strong>사무실 밖</strong>에서도 Tailscale 앱이 켜져 있는 기기라면 완벽하게 암호화되어 안전하게 접속됩니다.
                </p>

                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={tailscaleUrl}
                    className="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded font-mono font-bold text-emerald-900 text-sm select-all"
                  />
                  <button
                    onClick={() => handleCopy(tailscaleUrl, 'tailscale')}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold flex items-center gap-1 shadow-xs transition-colors shrink-0"
                  >
                    {copiedKey === 'tailscale' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedKey === 'tailscale' ? '복사됨!' : '주소 복사'}</span>
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800">💡 아버지 스마트폰/PC 설정 방법:</div>
                <div>1. 접속할 기기에 Tailscale 앱을 설치하고 동일 계정으로 로그인합니다.</div>
                <div>2. 위 주소(<code className="text-emerald-700 font-mono font-bold">{tailscaleUrl}</code>)로 접속하면 전 세계 어디서나 연결됩니다.</div>
              </div>
            </div>
          )}

          {activeTab === 'public' && (
            <div className="space-y-3">
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-lg p-3">
                <div className="font-bold text-indigo-900 flex items-center gap-1.5 mb-1">
                  <Globe className="w-4 h-4 text-indigo-600" />
                  전 세계 누구나 접속 가능한 무료 보안 터널 (HTTPS)
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Tailscale 설치 없이도 외부 고객사나 직원이 인터넷 링크만으로 접속할 수 있는 터널링 명령어를 제공합니다.
                </p>

                <div className="mt-3 bg-slate-900 text-slate-100 p-2.5 rounded font-mono text-xs flex items-center justify-between">
                  <code>npm run tunnel</code>
                  <button
                    onClick={() => handleCopy('npm run tunnel', 'cmd')}
                    className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[11px] flex items-center gap-1"
                  >
                    {copiedKey === 'cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'cmd' ? '복사완료' : '명령어 복사'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  * 터미널에서 위 명령어를 실행하면 전세계 접속용 <code className="text-indigo-700 font-bold">https://xxxx.loca.lt</code> 주소가 즉시 생성됩니다.
                </p>
              </div>
            </div>
          )}

          {/* Quick Share to Kakao / SMS Button */}
          <div className="border-t border-slate-200 pt-3">
            <button
              onClick={() => handleCopy(shareText, 'share')}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold flex items-center justify-center gap-2 transition-all border border-slate-300 shadow-2xs"
            >
              {copiedKey === 'share' ? (
                <Check className="w-4 h-4 text-emerald-600" />
              ) : (
                <Share2 className="w-4 h-4 text-blue-600" />
              )}
              <span>
                {copiedKey === 'share'
                  ? '카카오톡/문자 전송용 안내 문구가 복사되었습니다!'
                  : '아버지 / 직원 전달용 접속 안내 문구 전체 복사'}
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
          <span>호스트 서버: 0.0.0.0:{networkInfo?.port || 3000} (멀티 디바이스 실시간 수신 중)</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded font-semibold text-slate-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
