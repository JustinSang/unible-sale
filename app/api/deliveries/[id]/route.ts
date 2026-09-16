import { NextResponse } from 'next/server';
import { loadStore, saveStore } from '@/lib/store';
import type { DeliveryOrder } from '@/types';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const updates: Partial<DeliveryOrder> = await req.json();
    const store = loadStore();

    const idx = store.deliveries.findIndex(d => d.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: '배송 주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    const updated: DeliveryOrder = {
      ...store.deliveries[idx],
      ...updates,
      id
    };

    store.deliveries[idx] = updated;
    saveStore(store);

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '배송 정보 수정 실패' }, { status: 500 });
  }
}
