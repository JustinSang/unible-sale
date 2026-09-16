import { NextResponse } from 'next/server';
import { loadStore, saveStore } from '@/lib/store';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const store = loadStore();

    const slip = store.slips.find(s => s.id === id);
    if (!slip) {
      return NextResponse.json({ error: '전표를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Rollback customer receivables
    if (slip.slipType === 'sales') {
      const cust = store.customers.find(c => c.id === slip.customerId);
      if (cust) {
        cust.receivables = Math.max(0, (cust.receivables || 0) - slip.unpaidAmount);
      }
    }

    // Rollback stock
    slip.items.forEach(item => {
      const prod = store.products.find(p => p.id === item.productId || p.code === item.productCode);
      if (prod) {
        if (slip.slipType === 'sales') {
          prod.currentStock += item.qty;
        } else if (slip.slipType === 'purchase') {
          prod.currentStock -= item.qty;
        }
      }
    });

    // Remove deliveries associated with this slip
    store.deliveries = store.deliveries.filter(d => d.slipId !== id);

    // Remove slip
    store.slips = store.slips.filter(s => s.id !== id);

    saveStore(store);
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || '전표 삭제 실패' }, { status: 500 });
  }
}
