export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Customer } from '@/types';

export async function GET() {
  const { data, error } = await supabase.from('customers').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const data: Partial<Customer> = await req.json();

    let code = data.code;
    if (!code) {
      const { count } = await supabase.from('customers').select('*', { count: 'exact', head: true });
      code = `C${String((count || 0) + 1).padStart(5, '0')}`;
    }

    const newCustomer = {
      id: `c-${Date.now()}`,
      code,
      name: data.name || '신규 거래처',
      bizNumber: data.bizNumber || '',
      ceo: data.ceo || '',
      tel: data.tel || '',
      fax: data.fax || '',
      mobile: data.mobile || '',
      address: data.address || '',
      bizType: data.bizType || '',
      bizItem: data.bizItem || '',
      receivables: Number(data.receivables) || 0,
      payables: Number(data.payables) || 0,
      closingDay: Number(data.closingDay) || 30,
      priceTier: Number(data.priceTier) || 1,
      email: data.email || '',
      memo: data.memo || '',
      sites: data.sites || [],
      // 화면 양식의 나머지 칸(여신한도·영업사원·등급·최소마진율·담당자·직책·홈페이지·우편번호·은행·예금주·계좌·구분·부가세·전화2·3·존칭·상세주소 등)을 버리지 않는다.
      ...Object.fromEntries(['subBizNumber', 'creditLimit', 'salesman', 'grade', 'minMarginRate', 'contactName', 'contactDuty', 'homepage', 'zip', 'bank', 'accountHolder', 'account', 'taxEmail', 'category', 'vatType', 'tel2', 'tel3', 'title', 'address2', 'post']
        .filter(k => (data as Record<string, unknown>)[k] !== undefined && (data as Record<string, unknown>)[k] !== '')
        .map(k => [k, (data as Record<string, unknown>)[k]]))
    };

    const { error } = await supabase.from('customers').insert(newCustomer);
    if (error) throw new Error(error.message);

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '거래처 추가 실패' }, { status: 500 });
  }
}
