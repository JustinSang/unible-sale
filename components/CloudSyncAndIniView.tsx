'use client';

import React, { useState } from 'react';
import {
  Sliders,
  Printer,
  Cloud,
  Building,
  RefreshCw,
  RotateCcw,
  Save,
  CheckCircle2
} from 'lucide-react';
import type { SystemConfig, OSTheme } from '@/types';

interface CloudSyncAndIniViewProps {
  config: SystemConfig;
  onUpdateConfig: (cfg: Partial<SystemConfig>) => Promise<void>;
  onManualSync: () => Promise<void>;
  isSyncing: boolean;
  lastSyncTime: string;
  onResetDemo: () => Promise<void>;
  osTheme: OSTheme;
}

export function CloudSyncAndIniView({
  config,
  onUpdateConfig,
  onManualSync,
  isSyncing,
  lastSyncTime,
  onResetDemo,
  osTheme
}: CloudSyncAndIniViewProps) {
  const [formConfig, setFormConfig] = useState<SystemConfig>({ ...config });
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateConfig(formConfig);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className={`p-4 rounded-lg border shadow-xs ${
        osTheme === 'winxp-retro'
          ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-600" />
              <span>시스템 환경설정 및 INI 매핑 (Config.ini / Forms.Ini)</span>
            </h2>
            <p className="text-xs text-slate-500">
              클라우드 동기화 주기, 레거시 영수증/도트 프린터 설정 및 자사 사업자 정보 관리
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? '동기화 중...' : '즉시 동기화'}</span>
            </button>
            <button
              onClick={onResetDemo}
              className="px-3 py-1.5 text-xs font-semibold rounded border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center gap-1.5 shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>데모 데이터 초기화</span>
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4 text-xs">
        {/* Cloud Sync Settings */}
        <div className={`p-4 rounded-lg border shadow-xs ${
          osTheme === 'winxp-retro'
            ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
            : 'bg-white border-slate-200'
        }`}>
          <h3 className="font-bold text-xs text-slate-800 mb-3 flex items-center gap-1.5">
            <Cloud className="w-4 h-4 text-blue-600" />
            <span>실시간 클라우드 자동 동기화 설정</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="cloudSyncEnabled"
                checked={formConfig.cloudSyncEnabled}
                onChange={e =>
                  setFormConfig({ ...formConfig, cloudSyncEnabled: e.target.checked })
                }
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="cloudSyncEnabled" className="font-semibold text-slate-700 cursor-pointer">
                백그라운드 자동 동기화 활성화
              </label>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                동기화 주기 (초 단위)
              </label>
              <input
                type="number"
                min={5}
                max={300}
                value={formConfig.syncIntervalSec}
                onChange={e =>
                  setFormConfig({ ...formConfig, syncIntervalSec: Number(e.target.value) || 15 })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                UNIBLE SALE 로컬 MDB 변경사항을 주기적으로 클라우드에 실시간 업로드/다운로드합니다.
              </p>
            </div>
          </div>
        </div>

        {/* INI & Printer Settings */}
        <div className={`p-4 rounded-lg border shadow-xs ${
          osTheme === 'winxp-retro'
            ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
            : 'bg-white border-slate-200'
        }`}>
          <h3 className="font-bold text-xs text-slate-800 mb-3 flex items-center gap-1.5">
            <Printer className="w-4 h-4 text-blue-600" />
            <span>UNIBLE SALE Forms.Ini 및 프린터 설정</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                전표 / 영수증 프린터 (SlipPrinter)
              </label>
              <input
                type="text"
                value={formConfig.printers.slipPrinter}
                onChange={e =>
                  setFormConfig({
                    ...formConfig,
                    printers: { ...formConfig.printers, slipPrinter: e.target.value }
                  })
                }
                placeholder="삼성 BIOLON 80mm 영수증 프린터"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                세금계산서 도트 프린터 (TaxPrinter)
              </label>
              <input
                type="text"
                value={formConfig.printers.taxPrinter}
                onChange={e =>
                  setFormConfig({
                    ...formConfig,
                    printers: { ...formConfig.printers, taxPrinter: e.target.value }
                  })
                }
                placeholder="EPSON LQ-690K 도트 프린터"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                일반 거래명세표 프린터 (Printer)
              </label>
              <input
                type="text"
                value={formConfig.printers.printer}
                onChange={e =>
                  setFormConfig({
                    ...formConfig,
                    printers: { ...formConfig.printers, printer: e.target.value }
                  })
                }
                placeholder="HP LaserJet Pro M404"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                MDB 로컬 데이터 경로 (DBPath)
              </label>
              <input
                type="text"
                value={formConfig.dbPath}
                onChange={e => setFormConfig({ ...formConfig, dbPath: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className={`p-4 rounded-lg border shadow-xs ${
          osTheme === 'winxp-retro'
            ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
            : 'bg-white border-slate-200'
        }`}>
          <h3 className="font-bold text-xs text-slate-800 mb-3 flex items-center gap-1.5">
            <Building className="w-4 h-4 text-blue-600" />
            <span>자사(공급자) 사업자 정보 설정 (거래명세표/영수증 출력용)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">상호 (법인명)</label>
              <input
                type="text"
                value={formConfig.companyInfo.name}
                onChange={e =>
                  setFormConfig({
                    ...formConfig,
                    companyInfo: { ...formConfig.companyInfo, name: e.target.value }
                  })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">사업자등록번호</label>
              <input
                type="text"
                value={formConfig.companyInfo.bizNumber}
                onChange={e =>
                  setFormConfig({
                    ...formConfig,
                    companyInfo: { ...formConfig.companyInfo, bizNumber: e.target.value }
                  })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">대표자 성명</label>
              <input
                type="text"
                value={formConfig.companyInfo.ceo}
                onChange={e =>
                  setFormConfig({
                    ...formConfig,
                    companyInfo: { ...formConfig.companyInfo, ceo: e.target.value }
                  })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">전화번호</label>
              <input
                type="text"
                value={formConfig.companyInfo.tel}
                onChange={e =>
                  setFormConfig({
                    ...formConfig,
                    companyInfo: { ...formConfig.companyInfo, tel: e.target.value }
                  })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">사업장 주소</label>
              <input
                type="text"
                value={formConfig.companyInfo.address}
                onChange={e =>
                  setFormConfig({
                    ...formConfig,
                    companyInfo: { ...formConfig.companyInfo, address: e.target.value }
                  })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">업태</label>
              <input
                type="text"
                value={formConfig.companyInfo.bizType}
                onChange={e =>
                  setFormConfig({
                    ...formConfig,
                    companyInfo: { ...formConfig.companyInfo, bizType: e.target.value }
                  })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">종목</label>
              <input
                type="text"
                value={formConfig.companyInfo.bizItem}
                onChange={e =>
                  setFormConfig({
                    ...formConfig,
                    companyInfo: { ...formConfig.companyInfo, bizItem: e.target.value }
                  })
                }
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
              />
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center justify-between pt-2">
          {savedSuccess ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              설정이 안전하게 저장되었습니다!
            </span>
          ) : (
            <span />
          )}

          <button
            type="submit"
            className="px-6 py-2 text-xs font-bold rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>환경설정 저장</span>
          </button>
        </div>
      </form>
    </div>
  );
}
