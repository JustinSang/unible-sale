import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase.from('system_config').select('config').eq('id', 'default').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data?.config || {});
}

export async function PUT(req: Request) {
  try {
    const config = await req.json();
    const { error } = await supabase.from('system_config').upsert({ id: 'default', config });
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '설정 저장 실패' }, { status: 500 });
  }
}
