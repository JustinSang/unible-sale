'use client';

import React, { useState } from 'react';
import { BackupPanel } from '@/components/BackupPanel';
import { LoginSettingsPanel } from '@/components/LoginSettingsPanel';
import { ConfigHistoryPanel } from '@/components/ConfigHistoryPanel';
import { normalizeOptions, normalizePrint, DEFAULT_PRINT, type EnvOptions, type PrintOptions } from '@/lib/envOptions';
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
    try {
      await onUpdateConfig(formConfig);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      alert(err.message || '환경설정을 저장하지 못했습니다.');
    }
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

        {/* 금액 반올림 */}
        <div className={`p-4 rounded-lg border shadow-xs ${
          osTheme === 'winxp-retro'
            ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
            : 'bg-white border-slate-200'
        }`}>
          <h3 className="font-bold text-xs text-slate-800 mb-1">금액 계산 — 반올림 방식</h3>
          <p className="text-slate-500 mb-3">전표 줄마다 공급가액(수량×단가)과 부가세(10%)를 원 단위로 맞출 때의 방식입니다. 바꾸지 않으면 지금까지처럼 반올림입니다. 이미 저장된 전표는 바뀌지 않습니다.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['amt', 'vat'] as const).map(k => (
              <div key={k}>
                <label className="block font-semibold text-slate-700 mb-1">{k === 'amt' ? '공급가액' : '부가세'}</label>
                <select
                  value={(formConfig.calc || {})[k] || 'R'}
                  onChange={e => setFormConfig({ ...formConfig, calc: { amt: 'R', vat: 'R', ...(formConfig.calc || {}), [k]: e.target.value as 'R' | 'F' | 'C' } })}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                >
                  <option value="R">반올림 (기본)</option>
                  <option value="F">내림 (절사)</option>
                  <option value="C">올림</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* 전표 기본 설정(원본 «사용자 환경설정» 중 동작을 연결한 항목) */}
        <div className={`p-4 rounded-lg border shadow-xs ${
          osTheme === 'winxp-retro'
            ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
            : 'bg-white border-slate-200'
        }`}>
          <h3 className="font-bold text-xs text-slate-800 mb-1">전표 기본 설정</h3>
          <p className="text-slate-500 mb-3">전표를 입력하고 저장할 때 적용되는 기본값입니다. 바꾸지 않으면 지금까지와 똑같이 동작합니다. 아래 «환경설정 저장»을 눌러야 반영됩니다.</p>
          {(() => {
            const o = normalizeOptions(formConfig.options);
            const set = (patch: Partial<EnvOptions>) => setFormConfig({ ...formConfig, options: { ...o, ...patch } });
            const sel = 'w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white';
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">단가 소수점</label>
                  <select value={o.priceDecimals} onChange={e => set({ priceDecimals: Number(e.target.value) as EnvOptions['priceDecimals'] })} className={sel}>
                    <option value={0}>정수(소수점 없음)</option><option value={1}>소수점 1자리</option><option value={2}>소수점 2자리</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">전표 입력을 열 때의 기본값(전표 화면에서 바꿀 수도 있음)</p>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">수량 소수점</label>
                  <select value={o.qtyDecimals} onChange={e => set({ qtyDecimals: Number(e.target.value) as EnvOptions['qtyDecimals'] })} className={sel}>
                    <option value={0}>정수(소수점 없음)</option><option value={1}>소수점 1자리</option><option value={2}>소수점 2자리</option><option value={3}>소수점 3자리</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">입력·계산·저장할 때 이 자리수로 맞춥니다</p>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">부가가치세 세율 (%)</label>
                  <input type="number" min={0} max={100} step="0.1" value={o.vatRate} onChange={e => set({ vatRate: Number(e.target.value) })} className={sel} />
                  <p className="text-[10px] text-slate-400 mt-0.5">«부가세 별도(세액 가산)» 전표와 세금계산서 기본 세액에 쓰입니다</p>
                </div>
                <div className="md:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">상품 검색 방법 (전표 입력의 품목 검색)</label>
                  <select value={o.productSearch} onChange={e => set({ productSearch: e.target.value as EnvOptions['productSearch'] })} className={sel}>
                    <option value="basic">기본 — 입력한 글자 전체가 품명·규격·코드·분류·바코드 중 한 곳에 들어 있는 품목 (지금까지 방식)</option>
                    <option value="words">단어별 — 띄어 쓴 단어가 모두 들어 있는 품목 (예: «볼트 3/8», «앙카 1/2», «너트 M12»), 다른명칭도 검색, 품명이 첫 단어로 시작하는 품목을 먼저</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-0.5">«기본»에서는 품명과 규격을 띄어 써서 검색하면 결과가 나오지 않습니다. 단어 하나만 입력하면 두 방식 모두 같은 품목을 찾습니다.</p>
                </div>
                <label className="flex items-start gap-2 md:col-span-3 text-slate-700">
                  <input type="checkbox" checked={o.quickAddProduct} onChange={e => set({ quickAddProduct: e.target.checked })} className="mt-0.5" />
                  <span><b>전표 입력 중 새 품목 등록</b> — 품목 검색 결과가 없을 때 «새 품목으로 등록하고 전표에 담기» 버튼을 보입니다(같은 품명·규격이 이미 있으면 그 품목을 씁니다)</span>
                </label>
                <label className="flex items-start gap-2 md:col-span-3 text-slate-700">
                  <input type="checkbox" checked={o.creditLimitCheck} onChange={e => set({ creditLimitCheck: e.target.checked })} className="mt-0.5" />
                  <span><b>여신한도 관리</b> — 매출을 저장한 뒤 거래처 미수금이 그 거래처의 여신한도를 넘으면 저장 전에 확인을 묻습니다(한도를 0이나 빈칸으로 둔 거래처는 검사하지 않음)</span>
                </label>
                <label className="flex items-start gap-2 md:col-span-3 text-slate-700">
                  <input type="checkbox" checked={o.autoSaveSalesPrice} onChange={e => set({ autoSaveSalesPrice: e.target.checked })} className="mt-0.5" />
                  <span><b>매출가 자동 저장</b> — 매출 전표를 저장할 때 거래처별 단가(단가1→2→3 이력)를 자동으로 갱신합니다</span>
                </label>
                <label className="flex items-start gap-2 md:col-span-3 text-slate-700">
                  <input type="checkbox" checked={o.autoSavePurchasePrice} onChange={e => set({ autoSavePurchasePrice: e.target.checked })} className="mt-0.5" />
                  <span><b>매입가 자동 저장</b> — 매입 전표를 저장할 때 품목의 매입단가·최종매입처·최종매입일을 자동으로 갱신합니다</span>
                </label>
              </div>
            );
          })()}
        </div>

        {/* 거래명세표 선택 추가 출력 — 기본은 모두 꺼짐(지금 출력과 똑같다) */}
        <div className={`p-4 rounded-lg border shadow-xs ${
          osTheme === 'winxp-retro'
            ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
            : 'bg-white border-slate-200'
        }`}>
          <h3 className="font-bold text-xs text-slate-800 mb-1">거래명세표 추가 출력 (선택)</h3>
          <p className="text-slate-500 mb-3">«원본 양식» 거래명세표(인쇄·PDF·PDF 묶음)에 덧붙여 찍을 내용입니다. 모두 끄면 지금과 똑같이 출력됩니다. 저장 전 설정은 아래 «변경 이력»에서 언제든 되돌릴 수 있습니다.</p>
          {(() => {
            const o = normalizeOptions(formConfig.options); const p = normalizePrint(o.print);
            const setP = (patch: Partial<PrintOptions>) => setFormConfig({ ...formConfig, options: { ...o, print: { ...p, ...patch } } });
            return (
              <div className="space-y-2.5">
                <label className="flex items-start gap-2 text-slate-700"><input type="checkbox" checked={p.siteName} onChange={e => setP({ siteName: e.target.checked })} className="mt-0.5" /><span><b>현장명 출력</b> — 거래처 아래 빈 칸에 «현장: 현장명»을 찍습니다(전표에 현장이 지정된 경우)</span></label>
                <label className="flex items-start gap-2 text-slate-700"><input type="checkbox" checked={p.approvalOn} onChange={e => setP({ approvalOn: e.target.checked })} className="mt-0.5" /><span><b>결재란 출력</b> — 제목 오른쪽 위에 결재 칸을 그립니다</span></label>
                {p.approvalOn && <div className="pl-6 flex items-center gap-2"><span className="text-slate-600">칸 이름(쉼표로 구분, 최대 4개)</span><input value={p.approvalLabels} onChange={e => setP({ approvalLabels: e.target.value })} placeholder={DEFAULT_PRINT.approvalLabels} className="border border-slate-300 rounded px-2 py-1 w-48" /></div>}
                <label className="flex items-start gap-2 text-slate-700"><input type="checkbox" checked={p.messageOn} onChange={e => setP({ messageOn: e.target.checked })} className="mt-0.5" /><span><b>안내문 출력</b> — 아래 왼쪽에 한 줄을 찍습니다(예: 입금 계좌 안내)</span></label>
                {p.messageOn && <div className="pl-6"><input value={p.message} maxLength={60} onChange={e => setP({ message: e.target.value })} placeholder="안내문 (60자까지)" className="border border-slate-300 rounded px-2 py-1 w-full max-w-lg" /></div>}
                <div><button type="button" onClick={() => setP({ ...DEFAULT_PRINT })} className="text-slate-500 hover:text-blue-700 underline">추가 출력 모두 끄고 기본값으로</button></div>
              </div>
            );
          })()}
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

            <div>
              <label className="block font-semibold text-slate-700 mb-1">팩스번호</label>
              <input
                type="text"
                value={formConfig.companyInfo.fax || ''}
                onChange={e =>
                  setFormConfig({
                    ...formConfig,
                    companyInfo: { ...formConfig.companyInfo, fax: e.target.value }
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
      <ConfigHistoryPanel />
      <LoginSettingsPanel />
      <BackupPanel />
    </div>
  );
}
