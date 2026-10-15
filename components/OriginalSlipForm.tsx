'use client';

import React from 'react';
import type { Slip } from '@/types';

// 오케이세일(머니플러스) Slip.rpt «거래명세표» 배치를 따른 2단·16줄 양식.
// 근거: 원본 .rpt를 해독해 좌표를 복원(docs/analysis_rea/oksale/reports/rpt_layout.py → layouts/Slip.html). 단위는 twip(1/1440인치).
// - 한 쪽에 같은 명세표가 위(공급자 보관용)·아래(공급받는자 보관용) 두 벌, 벌마다 품목 16줄.
// - 열 경계 x = 969 · 5586 · 6612 · 7638 · 9348, 줄 영역 y = 2964~6840, 머리 칸 y = 912·1425·1881·2508, 아래 칸 y = 6840~.
// 지름길: 금액 칸의 값 위치(원본 .rpt에 해당 필드가 없음)·선 굵기·글꼴은 원본에서 읽지 못해 추정한다.
const MM = 0.017639; // 1 twip = 0.017639 mm
const tw = (n: number) => `${(n * MM).toFixed(2)}mm`;
const ROWS = 16;
const COPY_OFFSET = 7980; // 아래 벌 제목(T8094)과 위 벌 제목(T114)의 차이
const ROW_TOP = 3078;
const ROW_PITCH = 235; // (6840 − 3078 − 행높이 240) / 15 ≈ 235
const LEFT = 228;
const RIGHT = 11172;
const COLS = [969, 5586, 6612, 7638, 9348];
const won = (n: number) => Math.round(n || 0).toLocaleString('ko-KR');

export interface SlipParty {
  name: string;
  ceo?: string;
  bizNumber?: string;
  address?: string;
}

interface Props {
  slip: Slip;
  supplier: SlipParty; // 오른쪽 «등록번호·상호·성명·주소» 칸
  buyer: SlipParty; // 왼쪽 «거래처 귀하» 칸
  kindLabel: string;
  seal: string; // 도장 이미지 경로 — 공급자 칸 성명 옆
  prevBalance?: number;
  showPrev?: boolean;
  copies?: 'both' | 'recipient' | 'supplier'; // both=한 쪽에 위·아래 두 벌(인쇄·보관용) / recipient=받는 쪽 한 벌(팩스·전달용) / supplier=우리 보관용 한 벌
}

function Txt({ l, t, w, h, children, align, size, bold, nowrap = true }: { l: number; t: number; w: number; h: number; children: React.ReactNode; align?: 'left' | 'right' | 'center'; size?: number; bold?: boolean; nowrap?: boolean }) {
  return (
    <div style={{ position: 'absolute', left: tw(l), top: tw(t), width: tw(w), height: tw(h), lineHeight: tw(h), fontSize: `${size ?? 8.5}pt`, fontWeight: bold ? 700 : 400, textAlign: align || 'left', whiteSpace: nowrap ? 'nowrap' : 'normal', overflow: 'hidden' }}>{children}</div>
  );
}
function HLine({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return <div style={{ position: 'absolute', left: tw(x1), top: tw(y), width: tw(x2 - x1), borderTop: '0.25mm solid #000' }} />;
}
function VLine({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return <div style={{ position: 'absolute', left: tw(x), top: tw(y1), height: tw(y2 - y1), borderLeft: '0.25mm solid #000' }} />;
}

function Copy({ slip, supplier, buyer, kindLabel, seal, items, pageNo, pages, y0, tag, isLast, prevBalance, showPrev, totals }: Props & { items: Slip['items']; pageNo: number; pages: number; y0: number; tag: string; isLast: boolean; totals: { supply: number; tax: number; total: number } }) {
  const Y = (n: number) => n + y0;
  const blank = ROWS - items.length;
  return (
    <>
      <Txt l={4161} t={Y(114)} w={2181} h={399} align="center" size={16} bold>거래명세표</Txt>
      <Txt l={6384} t={Y(114)} w={1500} h={330} size={9}>({kindLabel}{pages > 1 ? ` ${pageNo}/${pages}` : ''})</Txt>
      <Txt l={285} t={Y(627)} w={798} h={210}>거래일자:</Txt>
      <Txt l={1083} t={Y(627)} w={3000} h={210} bold>{slip.slipDate}</Txt>
      {/* 머리 칸 */}
      <HLine x1={LEFT} x2={6270} y={Y(912)} /><HLine x1={LEFT} x2={6270} y={Y(1425)} /><HLine x1={LEFT} x2={6270} y={Y(1881)} /><HLine x1={LEFT} x2={6270} y={Y(2508)} />
      <VLine x={LEFT} y1={Y(912)} y2={Y(2508)} /><VLine x={6270} y1={Y(912)} y2={Y(2508)} />
      <HLine x1={6270} x2={RIGHT} y={Y(912)} /><HLine x1={6270} x2={RIGHT} y={Y(1425)} /><HLine x1={6270} x2={RIGHT} y={Y(1881)} />
      <VLine x={7068} y1={Y(912)} y2={Y(2508)} /><VLine x={RIGHT} y1={Y(912)} y2={Y(2508)} /><VLine x={9462} y1={Y(1425)} y2={Y(1881)} />
      <Txt l={285} t={Y(1083)} w={798} h={210}>거 래 처</Txt>
      <Txt l={1083} t={Y(1083)} w={4350} h={210} size={10} bold>{buyer.name}</Txt>
      <Txt l={5472} t={Y(1083)} w={456} h={180}>귀하</Txt>
      <Txt l={285} t={Y(1995)} w={798} h={210}>합계금액</Txt>
      <Txt l={1083} t={Y(1995)} w={5100} h={210} bold>₩ {won(slip.totalAmount)}</Txt>
      <Txt l={6327} t={Y(1083)} w={738} h={210}>등록번호</Txt>
      <Txt l={7125} t={Y(1083)} w={4000} h={210} size={9}>{supplier.bizNumber || ''}</Txt>
      <Txt l={6327} t={Y(1539)} w={684} h={195}>상   호</Txt>
      <Txt l={7125} t={Y(1539)} w={2300} h={195} size={9} bold>{supplier.name}</Txt>
      <Txt l={9519} t={Y(1596)} w={570} h={195}>성 명</Txt>
      <Txt l={10089} t={Y(1596)} w={800} h={195} size={9} bold>{supplier.ceo || ''}</Txt>
      {seal && <img src={seal} alt="인" style={{ position: 'absolute', left: tw(10750), top: tw(Y(1440)), width: tw(380), height: tw(380), mixBlendMode: 'multiply' }} />}
      <Txt l={6327} t={Y(1995)} w={684} h={195}>주   소</Txt>
      <div style={{ position: 'absolute', left: tw(7125), top: tw(Y(1930)), width: tw(RIGHT - 7125 - 40), height: tw(560), fontSize: '7.5pt', lineHeight: 1.25, overflow: 'hidden' }}>{supplier.address || ''}</div>
      {/* 품목 표 */}
      <HLine x1={LEFT} x2={RIGHT} y={Y(2508)} /><HLine x1={LEFT} x2={RIGHT} y={Y(2964)} /><HLine x1={LEFT} x2={RIGHT} y={Y(6840)} />
      <VLine x={LEFT} y1={Y(2508)} y2={Y(6840)} /><VLine x={RIGHT} y1={Y(2508)} y2={Y(6840)} />
      {COLS.map(x => <VLine key={x} x={x} y1={Y(2508)} y2={Y(6840)} />)}
      <Txt l={1026} t={Y(2622)} w={4503} h={228} align="center">품  명    및    규  격</Txt>
      <Txt l={5643} t={Y(2622)} w={912} h={228} align="center">단 위</Txt>
      <Txt l={6669} t={Y(2622)} w={912} h={228} align="center">수 량</Txt>
      <Txt l={7695} t={Y(2622)} w={1596} h={228} align="center">단  가</Txt>
      <Txt l={9405} t={Y(2622)} w={1767} h={228} align="center">금  액</Txt>
      {items.map((it, i) => {
        const t = Y(ROW_TOP + i * ROW_PITCH);
        return (
          <React.Fragment key={i}>
            <Txt l={1026} t={t} w={4503} h={240}>{it.productName}{it.spec ? `  ${it.spec}` : ''}</Txt>
            <Txt l={5643} t={t} w={912} h={240} align="center">{it.unit}</Txt>
            <Txt l={6669} t={t} w={912} h={240} align="right">{it.qty ? won(it.qty) : ''}</Txt>
            <Txt l={7695} t={t} w={1590} h={240} align="right">{it.unitPrice ? won(it.unitPrice) : ''}</Txt>
            <Txt l={9405} t={t} w={1700} h={240} align="right">{it.supplyAmount ? won(it.supplyAmount) : ''}</Txt>
          </React.Fragment>
        );
      })}
      {isLast && blank > 0 && <Txt l={1026} t={Y(ROW_TOP + items.length * ROW_PITCH)} w={4503} h={240}>--- 이하여백 ---</Txt>}
      {/* 아래 칸 */}
      <HLine x1={LEFT} x2={RIGHT} y={Y(7410)} />
      <VLine x={LEFT} y1={Y(6840)} y2={Y(7410)} /><VLine x={RIGHT} y1={Y(6840)} y2={Y(7410)} />
      {[2394, 4560, 6726, 8835].map(x => <VLine key={x} x={x} y1={Y(6840)} y2={Y(7410)} />)}
      <Txt l={228} t={Y(7011)} w={741} h={180} align="center">공급가액</Txt>
      <Txt l={969} t={Y(7011)} w={1380} h={180} align="right">{won(totals.supply)}</Txt>
      <Txt l={2451} t={Y(7068)} w={741} h={180} align="center">세 액</Txt>
      <Txt l={3192} t={Y(7068)} w={1330} h={180} align="right">{won(totals.tax)}</Txt>
      <Txt l={4617} t={Y(7068)} w={741} h={180} align="center">{isLast ? '합 계' : '소 계'}</Txt>
      <Txt l={5358} t={Y(7068)} w={1330} h={180} align="right" bold>{won(totals.total)}</Txt>
      <Txt l={6783} t={Y(6897)} w={741} h={180}>전잔액</Txt>
      <Txt l={7524} t={Y(6897)} w={1280} h={180} align="right">{showPrev === false || !isLast ? '' : won(prevBalance || 0)}</Txt>
      <Txt l={6783} t={Y(7182)} w={741} h={180}>총합계</Txt>
      <Txt l={7524} t={Y(7182)} w={1280} h={180} align="right" bold>{isLast ? won(totals.total + (showPrev === false ? 0 : prevBalance || 0)) : ''}</Txt>
      <Txt l={8892} t={Y(7068)} w={741} h={180}>인수자</Txt>
      <Txt l={10773} t={Y(7068)} w={399} h={195}>(인)</Txt>
      <Txt l={9291} t={Y(7467)} w={1881} h={180} align="right" size={8}>{tag}</Txt>
    </>
  );
}

export function OriginalSlipForm(props: Props) {
  const { slip } = props;
  const all = slip.items || [];
  const pages = Math.max(1, Math.ceil(all.length / ROWS));
  const chunks = Array.from({ length: pages }, (_, p) => all.slice(p * ROWS, (p + 1) * ROWS));
  const sum = (arr: Slip['items']) => ({ supply: arr.reduce((a, i) => a + (i.supplyAmount || 0), 0), tax: arr.reduce((a, i) => a + (i.taxAmount || 0), 0), total: arr.reduce((a, i) => a + (i.totalAmount || 0), 0) });
  const whole = { supply: slip.totalSupplyAmount ?? sum(all).supply, tax: slip.totalTaxAmount ?? sum(all).tax, total: slip.totalAmount ?? sum(all).total };
  return (
    <div className="bg-white text-black" style={{ fontFamily: '"Malgun Gothic","Apple SD Gothic Neo",sans-serif' }}>
      {chunks.map((items, p) => (
        <div key={p} data-pdf-page="" style={{ position: 'relative', width: tw(11906), height: tw(15570), margin: '0 auto 8px', border: '1px solid #cbd5e1', pageBreakAfter: 'always' }}>
          {(props.copies === 'recipient' ? [{ y0: 0, tag: '(공급받는자 보관용)' }] : props.copies === 'supplier' ? [{ y0: 0, tag: '(공급자 보관용)' }] : [{ y0: 0, tag: '(공급자 보관용)' }, { y0: COPY_OFFSET, tag: '(공급받는자 보관용)' }]).map(c => (
            <Copy key={c.y0} {...props} items={items} pageNo={p + 1} pages={pages} y0={c.y0} tag={c.tag} isLast={p === pages - 1} totals={p === pages - 1 ? whole : sum(items)} />
          ))}
        </div>
      ))}
    </div>
  );
}
