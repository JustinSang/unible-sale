'use client';

import React from 'react';
import type { Slip, SystemConfig, Customer } from '@/types';
import { OriginalSlipForm } from './OriginalSlipForm';
import { OriginalFormReport } from './OriginalFormReport';
import { cleanMask } from '@/lib/cleanMask';
import { normSlipType, SLIP_TYPE_LABEL } from '@/lib/slipType';

// 전표 한 장을 «원본 양식»으로: 견적·발주는 견적서·발주서 양식, 나머지는 거래명세표 2단·16줄 양식.
// PrintModal의 «원본 양식» 탭과 PDF 묶음이 같은 규칙을 쓰도록 한 곳에 모았다.

export function SlipOriginalForm({ slip: raw, config, customer }: { slip: Slip; config: SystemConfig; customer?: Customer }) {
  const slip: Slip = { ...raw, slipType: normSlipType(raw.slipType) };
  const ci = config.companyInfo;
  const inbound = slip.slipType === 'PURCHASE' || slip.slipType === 'RETURN_IN'; // 거래처가 보내고 우리가 받는 전표
  if (slip.slipType === 'ESTIMATE' || slip.slipType === 'ORDER') {
    return (
      <OriginalFormReport
        slip={slip}
        kind={slip.slipType === 'ESTIMATE' ? 'estimate' : 'order'}
        own={{ name: ci.name, ceo: ci.ceo, bizNumber: ci.bizNumber, address: ci.address, tel: ci.tel, fax: ci.fax, bizType: ci.bizType, bizItem: ci.bizItem }}
        counterpart={slip.customerName}
        seal="/seal-real.png"
      />
    );
  }
  const own = { name: ci.name, ceo: ci.ceo, bizNumber: ci.bizNumber, address: ci.address };
  const cust = { name: slip.customerName, ceo: customer?.ceo || '', bizNumber: cleanMask(customer?.bizNumber), address: slip.siteAddress || customer?.address || '' };
  return (
    <OriginalSlipForm
      slip={slip}
      supplier={inbound ? cust : own}
      buyer={inbound ? own : cust}
      kindLabel={SLIP_TYPE_LABEL[slip.slipType] || ''}
      seal={inbound ? '' : '/seal-real.png'}
      prevBalance={slip.prevReceivables}
      showPrev={slip.showPrevBalance !== false}
    />
  );
}
