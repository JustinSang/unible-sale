# 원본 Balance 표(거래처 월 집계) 규칙 — 실측 검증 (2026-10-15, 일론머스크2)

**근거(Evidence)**: Ghidra refs 함수 006835f0·00718810·007f0d70(`select * from Balance Where CustomerID=` → `insert into Balance (CustomerID, Kind,` / `Update Balance Set <열> = <값> Where CustomerID=`), 00684160·007f8440(읽기), 0065dbb0(전표 삭제 시 SlipHeader·SalesDetails 읽고 지움). 데이터: `~/Desktop/동산화스너/오케이세일/Data/S05~S26.mdb`의 `Balance`·`SlipHeader`. 대조 스크립트: `tools/balance_rule_fit.py`.

## 구조
- 원본은 연도 파일(S{연도2자리}.mdb)마다 `Balance`(거래처ID·Kind·AC00 + 월별 SA/RE/PU/PA/AC 01~12)를 **전표 저장·삭제 때 증감 유지**한다. 실데이터에서는 **AC 열만** 값이 있고 SA/RE/PU/PA는 전 파일에서 0.
- 전표 종류(SlipKind) 의미(실측 패턴): 1=매출(Total, 동시 수금 Receipt 가능) · 2=매입(Total, 동시 지급 Payment 가능) · 3=반품(음수 Total) · 9=수금 전표(Receipt만) · 0=지급 전표(Payment만) · 5·6·7=견적·주문·출고류 추정(Total 있으나 잔액 영향 없음) · A·B=구형(Amount만).

## 검증된 규칙 (S08~S26, 셀 7,830개 중 7,814개 일치 = 99.8%)
`AC(거래처, 월) = Σ[매출1.Total − 매출1.Receipt − 매입2.Total + 매입2.Payment − 반품3.Total]` (해당 월 전표 합, 거래처별). 즉 **월 순증감(미수금 방향)**이며 누적이 아니다.
- 불일치 16셀: S11·S12·S19·S20·S21·S22·S23의 일부(대부분 소액 차이, 원인 미확인 — 전표 수정·삭제 이력 가능성은 «추정»).
- **S05~S07은 이 식이 맞지 않음**(셀 227~590 중 138~520 불일치; 9·0 전표 반영해도 동일). 구형 형식으로 별도 규칙(원인 미확인).

## 의미(개발)
- 미수금·분기 집계표(QuarterSummary: BeforeBalance·MonthNSale·MonthNReceipt·Balance)의 «월 금액»은 이 순증감 구조 위에 있다. 전표 구조가 같은(S08~) 유니블세일 slips에 이 식을 적용해 월·분기 집계표를 만들 수 있다 — 구현 시 이 식과 «기존 데이터 대조 스크립트»를 테스트로 쓴다.
- Unknowns: SA/RE/PU/PA 열의 용도(실데이터 전부 0), Kind 열 의미(빈값·'1'), 열 증감식의 코드 상 정확한 순서, S05~S07 규칙, 일계표 SalesBuyingAmount·ReturnAmount 집계식(원본 출력 대조 불가).

## 구현·대조 (2026-10-15, 일론머스크2)
- 구현: `~/Desktop/동산화스너/oksale-web/lib/ledgerRules.ts`(`monthlyNet`) + 화면 «미수·미지급 집계표»(LedgerReportsView). 부호: 미수금 +, 미지급금 −. 반품: 매출반품 −Total, 매입반품 +Total(원본 «3:Total 계수 −1»을 부호 그대로 적용; 3건뿐인 표본이라 약한 근거).
- 대조: `scripts/verify_balance_rule.ts`가 Data/S08~S26.mdb 의 Balance를 TS 구현과 셀 단위 비교 → **7,830셀 중 불일치 16**(파이썬 대조와 동일). 화면은 로컬(3300)에서 실제 렌더 확인(스크린샷 파일은 저장하지 않음 — 화면 확인만).
- 새 사실: **원본 Balance는 «월 번호»로만 쌓는다** — S11.mdb에는 2010·2011 두 해 전표가 들어 있고 월 열(01~12)에 섞여 집계된다. 연도 필터를 걸면 563셀이 어긋남.
- 한계(Unknown): 전기 이월(AC00) 미반영 — 유니블세일 전표는 2024~2026뿐이라 이월 기준값을 아직 못 정함. 일계표 집계식·S05~S07 규칙은 그대로 미확인.

## 분기 집계표 (2026-10-15, 일론머스크2)
- 근거(Evidence): Ghidra refs 00799120·007aa130·007abf80(QuarterSummaryTable 열 `CustomerID, CustomerName, BeforeBalance, Month1Sale, Month1Receipt, Month2Sale, Month2Receipt, Month3Sale, Month3Receipt, Balance`), 007a2890·007b1380(`Where Balance >= 0` = «미수금 집계표», `Where Balance < 0` = «미지급금 집계표», `Order by Balance desc`/`Order by CustomerName`, 합계 행 «      합계»).
- 구현: `lib/ledgerRules.ts quarterSummary` + 화면(월별/분기 전환, 1~4분기, 미수금·미지급금 분리, 합계). 
- 대조: 분기말 잔액(전기+분기 순증감) vs 원본 Balance AC 누계 — 5,801셀 중 불일치 17(월 대조 16과 같은 원인). 화면 로컬 렌더 확인(1분기 6곳·합계 71,843,880 = 월합 14,753,840+31,581,190+25,508,850).
- **«매출/수금 구분»은 추정**: 원본에 매출·수금을 따로 저장한 값이 없고(Balance는 순증감 AC만) 분기 표 값은 실행 시 계산된다 — 우리 구분은 Sale=매출−매입−반품, Receipt=동시수금+수금−동시지급−지급이며 합(Sale−Receipt)만 실측 검증됨.
- Unknown: BeforeBalance가 원본에서 전년도 이월을 포함하는지(AC00은 전 파일 0), 한글 캡션·배치.

## 거래처 원장 (2026-10-15, 일론머스크2)
- Evidence: print.mdb `CustomerBookPrintTable`/`SalesQueryPrintTable` 열(SlipDate·Kind·ProductName·Spec·Unit·Qty·Price·Amount·Tax·Balance·Comments), Ghidra 함수 0074ea20(CustomerBook 채움: Select*→Insert, 서식 `######0.#0`), 0075ac10(SalesQuery 채움). 원본 `SalesDetails`(품목줄)의 합 = 전표 Total: S25 456/456, S20 2,729/2,730(실측).
- 구현: `lib/ledgerRules.ts customerLedger` + 화면 «거래처 원장»(거래처·기간 선택, 전기 이월→품목줄별 누적 잔액→기말 잔액, CSV). 품목합≠합계인 전표는 «(품목합 차액)» 줄로 잔액을 합계에 맞춘다(유니블세일 데이터에서 실제로 보임).
- 대조: 거래처별 품목줄 누적 최종 잔액 vs 원본 Balance AC 연합계 — 1,826건 중 불일치 8(원인 미확인, 월 대조 16셀과 같은 계열로 추정). 화면: 로컬에서 미동이엔씨 2026-01-01~조회, 품목줄 누적 잔액이 줄마다 +금액으로 증가(663,528,535 → +16,500 → 663,545,035) 확인.
- 한계: 한글 캡션·배치·«Kind» 표기값 원본 확정 못함(‹매출/매입› 라벨은 일계표 화면 문자열 근거), 전년도 이월 미반영.

## 전기 이월(기초잔액) — 원본에 저장 없음 → 입력 방식 (2026-10-15, 일론머스크2)
- 실측: ①`Balance.AC00`(기초)은 S08~S26 전 파일 0. ②전년도 AC 합계가 다음 해 AC00과 일치하는 경우 0건(S08→S25 비교, 일치 17건 미만·전부 우연 수준). ③SlipKind 5·6·7 전표는 이월 전표 아님(전년 합계와 일치 0/224). ④원본 거래처원장 함수 008c5770은 `' 이월'`·`-12-31`·`FUN_00684160`(Balance 읽기, AC00·월 열)을 쓰고, 연말이월 처리 함수 007f7460은 «YYYY년에서 YYYY+1년으로 이월합니다.» 확인창과 날짜 검증만 확인 — **실제 이월 쓰기 코드는 못 찾음(Unknown)**.
- 실측: 전표 AC를 2008~2026 누적하면 800050이 40억(대부분 미수 합 94억·미지급 −48억) — 전표만으로는 잔액이 발산한다. 2008년 이후 Account(분개장)도 비어 있다(Data/Master.mdb Account 3행) → **실제 수금·지급이 이 시스템에 기록되지 않은 구간이 크다**는 뜻이며, 미수금은 전표만으로 못 구한다.
- 대응(구현): `SystemConfig.openingBalances {asOf, byCustomer}`(system_config JSON, 스키마 변경 없음) + «기초잔액 입력» 화면(미수·미지급 집계표 탭). 기준일 시작 시점 잔액으로 간주해 **분기 집계 «전기 잔액»**(기준일~조회연도 사이 순증감 포함)과 **거래처 원장 «전기 이월»**에 반영. 로컬 mock으로 저장·반영 확인: 미동이엔씨 기초 1억 입력 시 1분기 전기잔액 100,000,000, 잔액 156,616,590 = 100,000,000+12,438,090+18,909,450+25,269,050.
- 알려진 기존 문제(수정 안 함): `app/page.tsx handleUpdateConfig`가 `/api/config`에 POST하나 라우트에는 GET·PUT뿐 → 그 경로는 405가 날 것.

## 월별 재고(Stock) 규칙 (2026-10-15, 일론머스크2)
- Evidence: Ghidra refs 0067cdd0·00686880(`select * from Stock Where ProductID=` → `insert into Stock (ProductID, … values (` / `Update Stock Set <열> = …`). 원본 `Stock` 표 열 ProductID·StoreHouseProductCode·S00~S12·P00~P12(S09 계열 파일 모두 동일).
- **실측 규칙**: `S{월}(품목) = −Σ매출(SlipKind 1) 수량 + Σ매입(2) 수량`(품목·월별, SalesDetails 기준). S08~S26 대조: 셀 50,373개 중 불일치 68(99.86%). **P00~P12는 전 파일에서 0(미사용)**, **S00(기초)도 0**.
- 반품(SlipKind 3)은 표본 3건뿐이라 부호 미확정(계수 +1/−1/0 모두 비슷) — 구현은 매출반품 +, 매입반품 −(재고가 돌아오는 방향)로 두고 «미확정»으로 표기.
- 구현: `lib/ledgerRules.ts monthlyStock` + 화면 «월별 재고 수불»(연도·품목 검색·월별 증감·입고계/출고계·CSV). 로컬 렌더 확인(2026년 138품목, 예: 외날피스 -10,500·-15,000·-20,000 → 출고계 45,500).
- 한계: 기초 재고·실사조정 미반영, 현재고(currentStock)·재고총액은 유니블세일 데이터의 매입가·현재고가 전부 0이라 계산 불가(이관 누락).

## 품목 매입가·현재고 (2026-10-15, 일론머스크2)
- 실측(원본 `Data/Master.mdb` Products 11,319품목): `StockOnHand` 전부 0·`Cost` 전부 0 — **원본도 현재고를 저장하지 않는다**(재고는 Stock 월 증감 표뿐, 기초 S00도 0). 따라서 «재고총액»을 원본 데이터로 구할 수 없다(원본 화면의 재고총액이 무엇을 합산하는지는 Unknown).
- 매입가: `PurchasePrice`>0 인 품목 4,714. 유니블세일 db.json(28,876품목, ID 중 11,319가 원본과 공통)은 매입가>0이 254건뿐 → 이관 누락. **`scripts/fill_product_costs.py`로 4,458품목의 비어 있던 매입가(+최종매입가·최종매입일)를 원본에서 채움**(이미 값 있는 칸 불변, db.json.bak_20261015 백업, 다른 키 동일 확인). 채운 뒤 매입가>0 = 4,712. 판매단가(SalesPrice)는 원본에도 58건뿐 — 판매가는 Price.mdb(거래처별 단가)에서 온다.
