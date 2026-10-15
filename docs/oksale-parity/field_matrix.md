| 오케이세일 표 | 칸(화면 이름) | 필드 | 유니블세일 | 대응 방식 |
|---|---|---|---|---|
| Customers | 고유번호 | CustomerID | Customer.code | 뜻 대응(판단) |
| Customers | 부서ID | PostID | **없음** |  |
| Customers | 구분 | Category | **없음** |  |
| Customers | 최소마진율 | BenefitRate | **없음** |  |
| Customers | 고객등급 | Class | **없음** |  |
| Customers | 영업사원 | SalesMan | **없음** |  |
| Customers | 여신한도액 | CreditLine | **없음** |  |
| Customers | 단가적용방법 | SalesPriceMode | Customer.priceTier | 뜻 대응(판단) |
| Customers | Vat관련 | TaxType | **없음** |  |
| Customers | 거래처명 | CustomerName | Customer.name | 뜻 대응(판단) |
| Customers | 대표 | OwnerName | Customer.ceo | 뜻 대응(판단) |
| Customers | 사업자번호 | TaxNo | Customer.bizNumber | 뜻 대응(판단) |
| Customers | 업태 | BusinessStatus | Customer.bizType | 뜻 대응(판단) |
| Customers | 종목 | BusinessType | Customer.bizItem | 뜻 대응(판단) |
| Customers | 부서 | Post | Customer.post | 이름 일치 |
| Customers | 담당자 | ChargerName | **없음** |  |
| Customers | 직책 | Duty | **없음** |  |
| Customers | 핸드폰 | TelephoneNo1 | Customer.mobile | 뜻 대응(판단) |
| Customers | 전화2 | TelephoneNo2 | Customer.tel | 뜻 대응(판단) |
| Customers | 전화3 | TelephoneNo3 | **없음** |  |
| Customers | 팩스번호 | FaxNo | Customer.fax | 뜻 대응(판단) |
| Customers | 회사전화 교환번호 | ExchangeNo | **없음** |  |
| Customers | eMail | eMail | Customer.email | 이름 일치 |
| Customers | 홈페이지 | HomePage | **없음** |  |
| Customers | 주소1 | Address1 | Customer.address | 뜻 대응(판단) |
| Customers | 주소1-1 | Address11 | **없음** |  |
| Customers | 주소1우편번호 | Address1Zip | **없음** |  |
| Customers | 우편발송용존칭(호칭) | Title | **없음** |  |
| Customers | 은행 | Bank | **없음** |  |
| Customers | 통장명 | BankBookName | **없음** |  |
| Customers | 예금주 | Depositor | **없음** |  |
| Customers | 계좌 | Account | **없음** |  |
| Customers | 비고 | Comments | Customer.memo | 뜻 대응(판단) |
| Customers | 메모 | Memo | Customer.memo | 이름 일치 |
| Products | 고유번호 | ProductID | **없음** |  |
| Products | 품번 | Code | Product.code | 이름 일치 |
| Products | 분류 | Category | Product.category | 이름 일치 |
| Products | 품명 | ProductName | Product.name | 뜻 대응(판단) |
| Products | 다른명칭 | NicName | **없음** |  |
| Products | 바코드 | Barcode | Product.barcode | 이름 일치 |
| Products | 규격 | Spec | Product.spec | 이름 일치 |
| Products | 색상 | Color | **없음** |  |
| Products | 사진 | ImagePath | **없음** |  |
| Products | 메이커 | Maker | **없음** |  |
| Products | 모델No | ModelNo | **없음** |  |
| Products | 단위 | Unit | Product.unit | 이름 일치 |
| Products | 중요등급 | Class | **없음** |  |
| Products | 과세여부 | TaxType | **없음** |  |
| Products | 화폐단위 | MoneyType | **없음** |  |
| Products | Qty | QtyPerUnit | **없음** |  |
| Products | 판매단가 | SalesPrice | Product.sellingPrice | 뜻 대응(판단) |
| Products | 소비자가 | BasicPrice | **없음** |  |
| Products | 판매단가1 | SalesPrice1 | **없음** |  |
| Products | 판매단가2 | SalesPrice2 | Product.sellingPrice2 | 뜻 대응(판단) |
| Products | 판매단가3 | SalesPrice3 | Product.sellingPrice3 | 뜻 대응(판단) |
| Products | 최종매입일 | PurchaseYMM | **없음** |  |
| Products | 매입단가 | PurchasePrice | **없음** |  |
| Products | 도매적용수량 | BenefitRate | **없음** |  |
| Products | 원가 | Cost | Product.costPrice | 뜻 대응(판단) |
| Products | 재고관리여부 | ChkStock | **없음** |  |
| Products | 할인율적용여부 | ChkDiscountRate | Product.discountRate | 뜻 대응(판단) |
| Products | 보관위치 | StockPosition | **없음** |  |
| Products | 안전재고 | SafetyStock | Product.safeStock | 뜻 대응(판단) |
| Products | 현재고 | StockOnHand | Product.currentStock | 뜻 대응(판단) |
| Products | 최종매입처1 | SupplierID1 | Product.supplier | 뜻 대응(판단) |
| Products | 최종매입일1 | PurchaseDate1 | **없음** |  |
| Products | 최종매입가1 | PurchasePrice1 | **없음** |  |
| Products | 최종매입처2 | SupplierID2 | **없음** |  |
| Products | 최종매입일2 | PurchaseDate2 | **없음** |  |
| Products | 최종매입가2 | PurchasePrice2 | **없음** |  |
| Products | 비고 | Comments | **없음** |  |
| Products | 메모 | Memo | Product.memo | 이름 일치 |
| Products | 확인일자 | CheckDate | **없음** |  |
| Products | 상위품목코드 | ParentProductID | **없음** |  |
| Price | 고유번호 | ProductID | CustomerPriceItem.productId | 이름 일치 |
| Price | 품번 | Code | **없음** |  |
| Price | 품명 | ProductName | CustomerPriceItem.productName | 이름 일치 |
| Price | 규격 | Spec | CustomerPriceItem.spec | 이름 일치 |
| Price | 단위 | Unit | **없음** |  |
| Price | 중요등급 | Date1 | **없음** |  |
| Price | 과세여부 | Date2 | **없음** |  |
| Price | 화폐단위 | Date3 | **없음** |  |
| Price | 판매단가1 | Price1 | CustomerPriceItem.price1 | 이름 일치 |
| Price | 판매단가2 | Price2 | CustomerPriceItem.price2 | 이름 일치 |
| Price | 판매단가3 | Price3 | CustomerPriceItem.price3 | 이름 일치 |
| Price | 최종매입일 | Kind | **없음** |  |
| Price | 재고관리여부 | Chk | **없음** |  |
| Price |  | UseAgreedPrice | **없음** |  |
| SlipHeader |  | SlipDate | Slip.slipDate | 이름 일치 |
| SlipHeader |  | SlipKind | Slip.slipType | 뜻 대응(판단) |
| SlipHeader |  | SlipID | **없음** |  |
| SlipHeader |  | SlipNo | Slip.slipNo | 이름 일치 |
| SlipHeader |  | CustomerID | Slip.customerId | 이름 일치 |
| SlipHeader |  | CustomerClass | **없음** |  |
| SlipHeader |  | CustomerName | Slip.customerName | 이름 일치 |
| SlipHeader |  | PostID | **없음** |  |
| SlipHeader |  | Post | **없음** |  |
| SlipHeader |  | Total | Slip.totalAmount | 뜻 대응(판단) |
| SlipHeader |  | Amount | Slip.totalSupplyAmount | 뜻 대응(판단) |
| SlipHeader |  | Tax | Slip.totalTaxAmount | 뜻 대응(판단) |
| SlipHeader |  | Receipt | Slip.paidAmount | 뜻 대응(판단) |
| SlipHeader |  | Payment | **없음** |  |
| SlipHeader |  | Discount | **없음** |  |
| SlipHeader |  | Balance | Slip.unpaidAmount | 뜻 대응(판단) |
| SlipHeader |  | AccountKind | Slip.paymentType | 뜻 대응(판단) |
| SlipHeader |  | TaxMode | **없음** |  |
| SlipHeader |  | TotalCost | **없음** |  |
| SlipHeader |  | EmployeeID | **없음** |  |
| SlipHeader |  | ShopCode | **없음** |  |
| SlipHeader |  | SlipTime | **없음** |  |
| SlipDetails |  | SlipDate | **없음** |  |
| SlipDetails |  | SlipID | SlipItem.id | 뜻 대응(판단) |
| SlipDetails |  | SlipNo | **없음** |  |
| SlipDetails |  | Sequence | **없음** |  |
| SlipDetails |  | CustomerID | **없음** |  |
| SlipDetails |  | PostID | **없음** |  |
| SlipDetails |  | ProductID | SlipItem.productId | 이름 일치 |
| SlipDetails |  | ProductCode | SlipItem.productCode | 이름 일치 |
| SlipDetails |  | Category | **없음** |  |
| SlipDetails |  | ProductName | SlipItem.productName | 이름 일치 |
| SlipDetails |  | Spec | SlipItem.spec | 이름 일치 |
| SlipDetails |  | Color | **없음** |  |
| SlipDetails |  | Unit | SlipItem.unit | 이름 일치 |
| SlipDetails |  | Qty | SlipItem.qty | 이름 일치 |
| SlipDetails |  | Price | SlipItem.unitPrice | 뜻 대응(판단) |
| SlipDetails |  | Amount | SlipItem.supplyAmount | 뜻 대응(판단) |
| SlipDetails |  | Tax | SlipItem.taxAmount | 뜻 대응(판단) |
| SlipDetails |  | Cost | **없음** |  |
| SlipDetails |  | DiscountRate | **없음** |  |
| SlipDetails |  | Comment | SlipItem.memo | 뜻 대응(판단) |
| SlipDetails |  | SlipTime | **없음** |  |
| SlipDetails |  | SlipKind | **없음** |  |
| SlipComments |  | SlipID | **없음** |  |
| SlipComments |  | Sequence | **없음** |  |
| SlipComments |  | Comment1 | Slip.memo | 뜻 대응(판단) |
| SlipComments |  | Comment2 | Slip.memo | 뜻 대응(판단) |
| SlipComments |  | Comment3 | Slip.memo | 뜻 대응(판단) |
| SlipComments |  | Comment4 | Slip.memo | 뜻 대응(판단) |
| SlipComments |  | SlipTime | **없음** |  |
