'use client';

import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  RefreshCw,
  FolderOpen,
  FileCode,
  CheckCircle,
  Database,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import type { OSTheme } from '@/types';

interface MdbAnalyzerViewProps {
  onRefreshData: () => Promise<void>;
  osTheme: OSTheme;
}

export function MdbAnalyzerView({ onRefreshData, osTheme }: MdbAnalyzerViewProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzedData, setAnalyzedData] = useState<{
    legacyPath: string;
    exists: boolean;
    totalFiles: number;
    files: Array<{ name: string; size: number; modified: string; type: string }>;
  } | null>(null);

  const fetchMdbInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mdb-analyze');
      if (res.ok) {
        const data = await res.json();
        setAnalyzedData(data);
      }
    } catch (err) {
      console.error('Failed to analyze mdb:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMdbInfo();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className={`p-4 rounded-lg border shadow-xs ${
        osTheme === 'winxp-retro'
          ? 'bg-[#d4d0c8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-600" />
              <span>레거시 MDB &rarr; UNIBLE SALE 데이터 분석 및 마이그레이션 엔진</span>
            </h2>
            <p className="text-xs text-slate-500">
              Visual Basic 6.0 MS Access MDB(Microsoft Jet Engine) 원본 구조 1:1 전수 분석 및 UNIBLE SALE 클라우드 동기화
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMdbInfo}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>다시 검사</span>
            </button>
          </div>
        </div>

        {/* Path Status */}
        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-amber-500" />
            <span className="text-slate-600 font-medium">탐지된 레거시 경로:</span>
            <code className="px-2 py-0.5 bg-slate-100 rounded text-slate-800 font-mono text-[11px] border border-slate-200">
              {analyzedData?.legacyPath || 'c:\\OkSale\\Data\\'}
            </code>
          </div>

          <div>
            {analyzedData?.exists ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5" /> 원본 MDB 파일 군(群) 확인됨 ({analyzedData.totalFiles}개 파일)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" /> 데모 에뮬레이션 모드로 가동 중
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Legacy MDB Architecture Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-blue-700 font-bold mb-1.5">
            <Database className="w-4 h-4" />
            <span>Master.mdb (기초원장)</span>
          </div>
          <p className="text-slate-600 mb-2 leading-relaxed">
            품목 마스터, 거래처 마스터, 담당자 및 공통 코드 테이블을 저장합니다.
          </p>
          <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[11px] font-mono text-slate-600">
            주요 테이블: Prd(품목), Customers(거래처), Code(분류)
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-emerald-700 font-bold mb-1.5">
            <Database className="w-4 h-4" />
            <span>Price.mdb (단가원장)</span>
          </div>
          <p className="text-slate-600 mb-2 leading-relaxed">
            거래처별 차등 단가, 품목별 특별 할인율 및 입고/출고 이력별 단가를 보관합니다.
          </p>
          <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[11px] font-mono text-slate-600">
            주요 테이블: CustPrice, SpecialRates, History
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2 text-purple-700 font-bold mb-1.5">
            <Database className="w-4 h-4" />
            <span>S00.mdb ~ S26.mdb (전표)</span>
          </div>
          <p className="text-slate-600 mb-2 leading-relaxed">
            연도별 매출/매입 전표 분할 파일입니다. S26은 2026년도 전표 데이터를 의미합니다.
          </p>
          <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[11px] font-mono text-slate-600">
            주요 테이블: SlipHeader, SlipDetail, Accounts
          </div>
        </div>
      </div>

      {/* Detected Files List */}
      <div className={`p-4 rounded-lg border shadow-xs ${
        osTheme === 'winxp-retro'
          ? 'bg-[#ece9d8] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080]'
          : 'bg-white border-slate-200'
      }`}>
        <h3 className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between">
          <span>UNIBLE SALE 로컬 MDB 원본 파일 목록</span>
          <span className="text-slate-500 font-normal">
            (총 {analyzedData?.files.length || 0}개 파일)
          </span>
        </h3>

        <div className="overflow-x-auto border border-slate-200 rounded max-h-72">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-semibold border-b sticky top-0">
                <th className="py-2 px-3">파일명</th>
                <th className="py-2 px-3">종류</th>
                <th className="py-2 px-3 text-right">파일 크기</th>
                <th className="py-2 px-3">최종 수정일</th>
                <th className="py-2 px-3">역할 매핑</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-mono text-[11px]">
              {!analyzedData || analyzedData.files.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 font-sans text-xs">
                    데이터 폴더에 파일이 없습니다.
                  </td>
                </tr>
              ) : (
                analyzedData.files.map((file, i) => {
                  let role = '일반 데이터';
                  if (file.name.toLowerCase() === 'master.mdb') role = '기초 품목/거래처 마스터';
                  else if (file.name.toLowerCase() === 'price.mdb') role = '거래처별 단가표';
                  else if (file.name.toLowerCase() === 'config.ini') role = '경로 및 시스템 환경설정';
                  else if (file.name.toLowerCase() === 'forms.ini') role = '프린터 및 스프레드시트 컬럼설정';
                  else if (file.name.match(/^s\d{2}\.mdb$/i)) role = `전표 데이터 (${file.name.slice(0, 3)})`;

                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-1.5 px-3 font-bold text-slate-800 flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-slate-400" />
                        <span>{file.name}</span>
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 uppercase">{file.type}</td>
                      <td className="py-1.5 px-3 text-right text-slate-700">
                        {formatFileSize(file.size)}
                      </td>
                      <td className="py-1.5 px-3 text-slate-500">
                        {file.modified.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td className="py-1.5 px-3 text-blue-700 font-sans font-medium">{role}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
