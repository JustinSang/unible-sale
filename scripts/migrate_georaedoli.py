#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import json
import subprocess
import csv
import io
from datetime import datetime

WORKSPACE = "/Users/justinsm1max/Desktop/동산화스너/oksale-web"
GEORAEDOLI_DB = os.path.join(WORKSPACE, "georaedoli/거래돌이관련/tax_40704A0101/Database.mdb")
OUTPUT_DB = os.path.join(WORKSPACE, "data/db.json")

def mdb_export(mdb_path, table_name):
    cmd = f'MDB_JET3_CHARSET="cp949" mdb-export "{mdb_path}" "{table_name}"'
    try:
        out = subprocess.check_output(cmd, shell=True, stderr=subprocess.DEVNULL)
        reader = csv.DictReader(io.StringIO(out.decode('utf-8', errors='replace')))
        return list(reader)
    except Exception as e:
        return []

def clean_str(val):
    if val is None: return ""
    return str(val).strip()

def clean_num(val, default=0):
    if val is None: return default
    s = str(val).replace(',', '').replace(' ', '').strip()
    try:
        if '.' in s: return int(float(s))
        return int(s)
    except:
        return default

def clean_float(val, default=0.0):
    if val is None: return default
    s = str(val).replace(',', '').replace(' ', '').strip()
    try:
        return float(s)
    except:
        return default

def main():
    print("=== 거래돌이 ERP 전수 데이터 마이그레이션 시작 ===")
    
    if not os.path.exists(GEORAEDOLI_DB):
        print(f"Error: {GEORAEDOLI_DB} 파일을 찾을 수 없습니다.")
        return

    # 1. tb품목 (Products)
    print("1) 품목 마스터 추출 중...")
    prods = mdb_export(GEORAEDOLI_DB, "tb품목")
    products_list = []
    
    for r in prods:
        pid = clean_str(r.get("품목id"))
        if not pid: continue
        name = clean_str(r.get("품명"))
        spec = clean_str(r.get("규격"))
        unit = clean_str(r.get("단위")) or "EA"
        
        selling = clean_num(r.get("단가"))
        selling2 = clean_num(r.get("도매단가"))
        selling3 = clean_num(r.get("특판단가"))
        cost = clean_num(r.get("매입단가"))
        
        products_list.append({
            "id": f"p-gr-{pid}",
            "code": clean_str(r.get("코드")) or f"GR-{pid}",
            "name": name,
            "spec": spec,
            "unit": unit,
            "costPrice": cost,
            "sellingPrice": selling,
            "sellingPrice2": selling2,
            "sellingPrice3": selling3,
            "currentStock": clean_num(r.get("현재고")),
            "safeStock": 0,
            "category": "일반자재",
            "memo": clean_str(r.get("비고"))
        })
    print(f"-> 추출 완료된 품목 수: {len(products_list):,}개")

    # 2. tb거래처 (Customers)
    print("2) 거래처 및 공사현장 마스터 1:N 구조 분석 중...")
    custs = mdb_export(GEORAEDOLI_DB, "tb거래처")
    customers_map = {}
    
    # 본사 식별용 (동일 사업자번호는 현장으로 묶음)
    biz_map = {}
    
    for r in custs:
        cid = clean_str(r.get("거래처id"))
        if not cid: continue
        name = clean_str(r.get("상호"))
        biz_no = clean_str(r.get("사업자번호")).replace("-", "")
        sub_biz = clean_str(r.get("종사업자번호"))
        ceo = clean_str(r.get("대표자"))
        tel = clean_str(r.get("전화"))
        fax = clean_str(r.get("팩스"))
        mobile = clean_str(r.get("휴대폰"))
        email = clean_str(r.get("이메일"))
        tax_email = clean_str(r.get("세금계산서이메일")) or email
        addr = clean_str(r.get("주소"))
        biz_type = clean_str(r.get("업태"))
        biz_item = clean_str(r.get("종목"))
        memo = clean_str(r.get("비고"))
        receivables = clean_num(r.get("미수금"))
        
        price_tier = clean_num(r.get("단가등급"), 1)
        if price_tier not in [1,2,3]: price_tier = 1

        cust_obj = {
            "id": f"c-gr-{cid}",
            "code": f"GR-C{cid}",
            "name": name,
            "bizNumber": biz_no,
            "subBizNumber": sub_biz,
            "ceo": ceo,
            "tel": tel,
            "fax": fax,
            "mobile": mobile,
            "address": addr,
            "bizType": biz_type,
            "bizItem": biz_item,
            "receivables": receivables,
            "closingDay": 25,
            "email": email,
            "taxEmail": tax_email,
            "priceTier": price_tier,
            "memo": memo,
            "sites": []
        }
        
        if biz_no and biz_no in biz_map:
            main_cust = customers_map[biz_map[biz_no]]
            main_cust["sites"].append({
                "id": f"site-gr-{cid}",
                "siteCode": f"S-{cid}",
                "siteName": name,
                "manager": ceo,
                "tel": tel or mobile,
                "address": addr,
                "memo": memo
            })
        else:
            customers_map[cid] = cust_obj
            if biz_no:
                biz_map[biz_no] = cid
                
    customers_list = list(customers_map.values())
    print(f"-> 추출 완료된 거래처 본사 수: {len(customers_list):,}곳 (산하 공사현장 자동 분류)")

    # 3. tb전표, tb전표내역 (Slips)
    print("3) 전표 및 전표 상세내역 추출 중...")
    headers = mdb_export(GEORAEDOLI_DB, "tb전표")
    details = mdb_export(GEORAEDOLI_DB, "tb전표내역")
    
    details_by_slip = {}
    for d in details:
        sid = clean_str(d.get("전표id"))
        if sid not in details_by_slip:
            details_by_slip[sid] = []
        details_by_slip[sid].append(d)
        
    slips_list = []
    
    for h in headers:
        sid = clean_str(h.get("전표id"))
        if not sid: continue
        
        sdate = clean_str(h.get("일자"))
        cid = clean_str(h.get("거래처id"))
        cname = clean_str(h.get("상호"))
        
        slip_type_code = clean_str(h.get("구분"))
        slip_type = "sales" if "매출" in slip_type_code or slip_type_code == "1" else "purchase"
        
        raw_items = details_by_slip.get(sid, [])
        items = []
        for idx, item in enumerate(raw_items):
            pid = clean_str(item.get("품목id"))
            pname = clean_str(item.get("품명"))
            qty = clean_float(item.get("수량"), 1.0)
            unit_price = clean_num(item.get("단가"))
            supply = clean_num(item.get("공급가액"), int(qty * unit_price))
            tax = clean_num(item.get("세액"), int(supply * 0.1))
            
            items.append({
                "id": f"si-gr-{sid}-{idx}",
                "productId": f"p-gr-{pid}" if pid else "",
                "productCode": "",
                "productName": pname,
                "spec": clean_str(item.get("규격")),
                "unit": clean_str(item.get("단위")) or "EA",
                "qty": qty,
                "unitPrice": unit_price,
                "supplyAmount": supply,
                "taxAmount": tax,
                "totalAmount": supply + tax,
                "memo": clean_str(item.get("비고"))
            })
            
        total_supply = sum(i["supplyAmount"] for i in items)
        total_tax = sum(i["taxAmount"] for i in items)
        total_amount = total_supply + total_tax
        paid_amount = clean_num(h.get("입금액"))
        
        slips_list.append({
            "id": f"s-gr-{sid}",
            "slipNo": f"GR-{sdate.replace('-','')}-{sid}",
            "slipDate": sdate,
            "slipType": slip_type,
            "customerId": f"c-gr-{cid}" if cid else "",
            "customerName": cname,
            "siteId": "",
            "siteName": "",
            "siteManager": "",
            "siteAddress": "",
            "items": items,
            "totalSupplyAmount": total_supply,
            "totalTaxAmount": total_tax,
            "totalAmount": total_amount,
            "paymentType": "credit" if total_amount > paid_amount else "cash",
            "paidAmount": paid_amount,
            "unpaidAmount": max(0, total_amount - paid_amount),
            "prevReceivables": 0,
            "memo": clean_str(h.get("비고")),
            "createdAt": f"{sdate}T09:00:00.000Z",
            "deliveryStatus": "delivered"
        })
        
    print(f"-> 추출 완료된 실무 전표 수: {len(slips_list):,}건")
    
    os.makedirs(os.path.dirname(OUTPUT_DB), exist_ok=True)
    
    system_config = {
        "dbPath": "c:\\OkSale\\Data\\",
        "reportPath": "c:\\OkSale\\Data\\",
        "printers": {
            "slipPrinter": "삼성 BIOLON 80mm 영수증 프린터",
            "taxPrinter": "EPSON LQ-690K 도트 프린터",
            "printer": "HP LaserJet Pro M404"
        },
        "cloudSyncEnabled": True,
        "syncIntervalSec": 15,
        "lastSyncTime": datetime.now().isoformat(),
        "companyInfo": {
            "name": "동산화스너 (UNIBLE SALE 클라우드 본사)",
            "bizNumber": "120-81-45678",
            "ceo": "홍길동",
            "address": "서울특별시 금천구 가산디지털1로 145 에이스하이엔드타워 3차 502호",
            "tel": "02-850-7000",
            "bizType": "제조 및 도소매",
            "bizItem": "볼트, 너트, 화스너 및 철물 일체"
        }
    }

    final_db = {
        "products": products_list,
        "customers": customers_list,
        "slips": slips_list,
        "deliveries": [],
        "inventoryLogs": [],
        "bills": [],
        "taxInvoices": [],
        "config": system_config
    }
    
    with open(OUTPUT_DB, "w", encoding="utf-8") as f:
        json.dump(final_db, f, ensure_ascii=False, indent=2)
        
    print(f"=== 거래돌이 ERP 데이터베이스 1:1 파싱 및 병합(교체) 완료! ({OUTPUT_DB}) ===")

if __name__ == "__main__":
    main()
