'use client';

import React from 'react';
import type { Slip } from '@/types';

// 오케이세일(머니플러스) Estimate1.rpt(견적서)·Order.rpt(발주서) 배치를 따른 양식.
// 근거: 원본 .rpt를 해독해 복원한 구역·좌표(docs/analysis_rea/oksale/reports/rpt_layout.py, layouts/Estimate1.html·Order.html). 단위 twip.
// 구역: 머리(높이 3979) · 열 머리(362) · 상세 줄(300, 줄마다 아래 선) · Remark(1339 견적/1038 발주) · 합계(420, 견적만 문구) · 쪽 바닥(600, 상호·Page).
// 지름길: 선 굵기·글꼴·정렬, 머리 상자 아래 끝(T3330), 합계문구(@HeaderTotal·@FooterTotal) 모양, 오른쪽 끝 x(10890), 쪽 높이(A4)는 원본에서 못 읽어 추정한다.
const MM = 0.017639;
const tw = (n: number) => `${(n * MM).toFixed(2)}mm`;
const won = (n: number) => Math.round(n || 0).toLocaleString('ko-KR');
const PAGE_W = 11906;
const PAGE_H = 16838;
const LEFT = 741;
const RIGHT = 10890;
const HEADER_H = 3979;
const COLHEAD_H = 362;
const ROW_H = 300;
const FOOT_PAGE_H = 600;

export interface FormParty { name: string; ceo?: string; bizNumber?: string; address?: string; tel?: string; fax?: string; bizType?: string; bizItem?: string }
interface Props { slip: Slip; kind: 'estimate' | 'order' | 'request'; own: FormParty; counterpart: string; seal?: string }

function T({ l, t, w, h, children, align, size, bold }: { l: number; t: number; w: number; h: number; children: React.ReactNode; align?: 'left' | 'right' | 'center'; size?: number; bold?: boolean }) {
  return <div style={{ position: 'absolute', left: tw(l), top: tw(t), width: tw(w), height: tw(h), lineHeight: tw(h), fontSize: `${size ?? 9}pt`, fontWeight: bold ? 700 : 400, textAlign: align || 'left', whiteSpace: 'nowrap', overflow: 'hidden' }}>{children}</div>;
}
const H = ({ x1, x2, y }: { x1: number; x2: number; y: number }) => <div style={{ position: 'absolute', left: tw(x1), top: tw(y), width: tw(x2 - x1), borderTop: '0.25mm solid #000' }} />;
const V = ({ x, y1, y2 }: { x: number; y1: number; y2: number }) => <div style={{ position: 'absolute', left: tw(x), top: tw(y1), height: tw(y2 - y1), borderLeft: '0.25mm solid #000' }} />;

function koreanAmount(n: number): string {
  if (!n) return '영';
  const d = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'], u = ['', '십', '백', '천'], big = ['', '만', '억', '조'];
  let out = '', grp = 0, v = Math.abs(Math.round(n));
  while (v > 0) {
    const part = v % 10000; v = Math.floor(v / 10000);
    if (part) { let s = ''; [...String(part).padStart(4, '0')].forEach((c, i) => { const x = +c; if (x) s += (x === 1 && i < 3 ? '' : d[x]) + u[3 - i]; }); out = s + big[grp] + out; }
    grp++;
  }
  return out;
}

export function OriginalFormReport({ slip, kind, own, counterpart, seal }: Props) {
  const isEst = kind === 'estimate';
  const hasPriceCols = kind !== 'order'; // 견적의뢰서는 단가·금액 칸이 머리글만 있고 값은 비워 둔다(견적 받는 쪽이 적음)
  const items = slip.items || [];
  const remarks = (slip.memo || '').split(/\n| \/ (?=\[)/).map(s => s.replace(/^\[참조사항\]\s*/, '').trim()).filter(s => s && !/^\[현장:[^\]]*\]$/.test(s)).slice(0, 4);
  const cols = hasPriceCols ? [1311, 3534, 5586, 6441, 7353, 8523, 9870] : [1311, 3534, 5586, 6441, 7353];
  // 쪽 나눔: 첫 쪽은 머리 구역 아래, 마지막 쪽은 Remark·합계 구역 자리를 남긴다.
  const lastReserve = (isEst ? 1339 : 1038) + (isEst ? 420 : 0);
  const capFirst = Math.floor((PAGE_H - FOOT_PAGE_H - HEADER_H - COLHEAD_H) / ROW_H);
  const capNext = Math.floor((PAGE_H - FOOT_PAGE_H - COLHEAD_H) / ROW_H);
  const capLastFirst = Math.floor((PAGE_H - FOOT_PAGE_H - HEADER_H - COLHEAD_H - lastReserve) / ROW_H);
  const capLast = Math.floor((PAGE_H - FOOT_PAGE_H - COLHEAD_H - lastReserve) / ROW_H);
  const pages: Slip['items'][] = [];
  let rest = items.slice(), first = true;
  while (true) {
    const fitsLast = rest.length <= (first ? capLastFirst : capLast);
    if (fitsLast) { pages.push(rest); break; }
    const cap = first ? capFirst : capNext; pages.push(rest.slice(0, cap)); rest = rest.slice(cap); first = false;
  }
  return (
    <div className="bg-white text-black" style={{ fontFamily: '"Malgun Gothic","Apple SD Gothic Neo",sans-serif' }}>
      {pages.map((rows, p) => {
        const isFirst = p === 0, isLast = p === pages.length - 1;
        const y0 = isFirst ? HEADER_H : 0; // 열 머리 시작 y
        const bodyTop = y0 + COLHEAD_H;
        const bodyBottom = bodyTop + rows.length * ROW_H;
        let no0 = pages.slice(0, p).reduce((a, r) => a + r.length, 0);
        return (
          <div key={p} style={{ position: 'relative', width: tw(PAGE_W), height: tw(PAGE_H), margin: '0 auto 8px', border: '1px solid #cbd5e1', pageBreakAfter: 'always' }}>
            {isFirst && (
              <>
                <T l={4389} t={isEst ? 741 : 720} w={3147} h={isEst ? 484 : 450} align="center" size={18} bold>{isEst ? '見  積  書' : kind === 'request' ? '견적의뢰서' : '發 注 書'}</T>
                <H x1={4389} x2={7536} y={1197} />
                <T l={855} t={1482} w={664} h={228}>No. :</T>
                <T l={1596} t={1482} w={3000} h={228}>{slip.slipNo}</T>
                <T l={855} t={1938} w={675} h={228}>일자:</T>
                <T l={1596} t={1938} w={2265} h={221} bold>{slip.slipDate}</T>
                <T l={1596} t={2280} w={3420} h={221} size={10.5} bold>{counterpart}</T>
                <T l={5073} t={2280} w={555} h={221}>貴中</T>
                <T l={855} t={2793} w={675} h={228}>참조:</T>
                {isEst && <T l={1596} t={2793} w={3306} h={221}>{slip.siteName || ''}</T>}
                <T l={1425} t={3135} w={4147} h={255} bold>{isEst ? '下記와 같이 見積 하나이다.' : kind === 'request' ? '下記와 같이 견적의뢰 하나이다.' : '下記와 같이 發注 하나이다.'}</T>
                <T l={912} t={3591} w={969} h={297}>합계금액:</T>
                {isEst && <T l={1938} t={3591} w={8731} h={285} size={10.5} bold>일금 {koreanAmount(slip.totalAmount)}원정  (₩{won(slip.totalAmount)})</T>}
                {/* 왼쪽 칸 선 */}
                {[1710, 2166, 2565, 3021, 3477].map(y => <H key={y} x1={LEFT} x2={5990} y={y} />)}
                {/* 오른쪽 공급자 상자 */}
                {[1380, 1740, 2166, 2565, 2964, 3330].map(y => <H key={y} x1={6060} x2={RIGHT} y={y} />)}
                <V x={6060} y1={1380} y2={3330} /><V x={6498} y1={1380} y2={3330} /><V x={RIGHT} y1={1380} y2={3330} /><V x={7386} y1={1380} y2={3330} /><V x={9840} y1={1740} y2={2166} /><V x={9060} y1={2964} y2={3330} />
                {isEst ? <><T l={6180} t={1747} w={282} h={280}>공</T><T l={6180} t={2280} w={282} h={280}>급</T><T l={6180} t={2640} w={282} h={280}>자</T></>
                  : <><T l={6180} t={1747} w={318} h={280}>발</T><T l={6180} t={2280} w={282} h={240}>주</T><T l={6180} t={2640} w={282} h={280}>자</T></>}
                <T l={6540} t={1500} w={780} h={240}>사업번호</T><T l={7590} t={1500} w={2910} h={221} bold>{own.bizNumber || ''}</T>
                <T l={6540} t={1938} w={780} h={240}>상    호</T><T l={7440} t={1860} w={2340} h={240} bold>{own.name}</T><T l={9960} t={1881} w={870} h={221}>{own.ceo || ''}</T>
                {seal && <img src={seal} alt="인" style={{ position: 'absolute', left: tw(10440), top: tw(1700), width: tw(420), height: tw(420), mixBlendMode: 'multiply' }} />}
                <T l={6540} t={2280} w={780} h={240}>주    소</T><T l={7440} t={2280} w={3360} h={221} size={8}>{own.address || ''}</T>
                <T l={6600} t={2640} w={720} h={240}>Tel,Fax</T><T l={7500} t={2700} w={1500} h={221}>{own.tel || ''}</T><T l={9000} t={2700} w={135} h={240}>,</T><T l={9240} t={2679} w={1542} h={221}>{own.fax || ''}</T>
                <T l={6600} t={3060} w={720} h={240}>업태종목</T><T l={7440} t={3078} w={1560} h={240}>{own.bizType || ''}</T><T l={9180} t={3060} w={1620} h={221} size={8.5}>{own.bizItem || ''}</T>
              </>
            )}
            {/* 열 머리 */}
            <H x1={LEFT} x2={RIGHT} y={y0} /><H x1={LEFT} x2={RIGHT} y={y0 + COLHEAD_H - 20} />
            <V x={LEFT} y1={y0} y2={bodyBottom} /><V x={RIGHT} y1={y0} y2={bodyBottom} />
            {cols.map(x => <V key={x} x={x} y1={y0} y2={bodyBottom} />)}
            <T l={798} t={y0 + 57} w={431} h={279} align="center">No.</T>
            <T l={1368} t={y0 + 57} w={2109} h={279} align="center">품 명</T>
            <T l={3591} t={y0 + 57} w={1938} h={279} align="center">규 격</T>
            <T l={5643} t={y0 + 57} w={741} h={279} align="center">단위</T>
            <T l={6498} t={y0 + 57} w={798} h={279} align="center">수량</T>
            {hasPriceCols ? (<><T l={7467} t={y0 + 57} w={1008} h={279} align="center">단가</T><T l={8607} t={y0 + 57} w={1197} h={279} align="center">금액</T><T l={9918} t={y0 + 57} w={969} h={279} align="center">비고</T></>)
              : <T l={7440} t={y0 + 57} w={3447} h={279} align="center">비고</T>}
            {/* 상세 줄 */}
            {rows.map((it, i) => {
              const t = bodyTop + i * ROW_H;
              return (
                <React.Fragment key={i}>
                  <H x1={LEFT} x2={RIGHT} y={t + ROW_H} />
                  <T l={780} t={t + 60} w={480} h={228} align="center" size={8}>{no0 + i + 1}</T>
                  <T l={1386} t={t + 66} w={2112} h={202}>{it.productName}</T>
                  <T l={3600} t={t + 66} w={1920} h={202} size={8.5}>{it.spec}</T>
                  <T l={5610} t={t + 66} w={792} h={202} align="center">{it.unit}</T>
                  <T l={6498} t={t + 66} w={828} h={228} align="right">{it.qty ? won(it.qty) : ''}</T>
                  {hasPriceCols ? (<><T l={7458} t={t + 66} w={990} h={228} align="right">{isEst && it.unitPrice ? won(it.unitPrice) : ''}</T><T l={8580} t={t + 66} w={1254} h={228} align="right">{isEst && it.supplyAmount ? won(it.supplyAmount) : ''}</T><T l={9918} t={t + 66} w={940} h={202} size={8}>{it.memo || ''}</T></>)
                    : <T l={7440} t={t + 66} w={3400} h={202} size={8.5}>{it.memo || ''}</T>}
                </React.Fragment>
              );
            })}
            {/* Remark·합계 (마지막 쪽) */}
            {isLast && (
              <>
                <T l={840} t={bodyBottom + 120} w={900} h={210}> Remark:</T>
                {remarks.map((r, i) => <T key={i} l={1928} t={bodyBottom + 120 + i * 240} w={5932} h={198} size={8.5}>{r}</T>)}
                {isEst && <T l={2793} t={bodyBottom + (isEst ? 1339 : 1038) + 57} w={7068} h={285} size={10} bold align="right">합계 ₩{won(slip.totalAmount)}</T>}
              </>
            )}
            {/* 쪽 바닥 */}
            <T l={4902} t={PAGE_H - FOOT_PAGE_H + 342} w={1881} h={240} align="center" size={8}>{own.name}</T>
            <T l={9690} t={PAGE_H - FOOT_PAGE_H + 342} w={664} h={228} size={8}>Page:</T>
            <T l={10500} t={PAGE_H - FOOT_PAGE_H + 360} w={420} h={198} size={8}>{p + 1}</T>
          </div>
        );
      })}
    </div>
  );
}
