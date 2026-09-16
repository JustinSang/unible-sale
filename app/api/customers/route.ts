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
      sites: data.sites || []
    };

    const { error } = await supabase.from('customers').insert(newCustomer);
    if (error) throw new Error(error.message);

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '거래처 추가 실패' }, { status: 500 });
  }
}
