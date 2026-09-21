import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Resend } from 'resend';

// Initialize SDKs (they will safely fail if keys are missing but won't crash the build)
const resend = new Resend(process.env.RESEND_API_KEY || 'dummy_key');
// solapi and popbill would be initialized here when the user provides keys
// const { Message } = require('solapi');
// const popbill = require('popbill');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slipId, channel, targetContact } = body;
    
    if (!slipId || !channel || !targetContact) {
      return NextResponse.json({ success: false, error: 'Missing required parameters.' }, { status: 400 });
    }

    // 1. Fetch Slip Data for generating HTML/Content
    const { data: slip, error: slipError } = await supabase
      .from('slips')
      .select('*')
      .eq('id', slipId)
      .single();

    if (slipError || !slip) {
      return NextResponse.json({ success: false, error: 'Slip not found.' }, { status: 404 });
    }

    // 1.5 Auto-save new contact info to Customer DB
    if (slip.customerId) {
      const { data: customer } = await supabase.from('customers').select('*').eq('id', slip.customerId).single();
      if (customer) {
        let updateData: any = {};
        if (channel === 'EMAIL' && customer.email !== targetContact) {
          updateData.email = targetContact;
        } else if (channel === 'FAX' && customer.tel !== targetContact) {
          // Typically fax is saved to tel or mobile, we update tel here if it's different and FAX was sent
          updateData.tel = targetContact;
        }
        
        if (Object.keys(updateData).length > 0) {
          await supabase.from('customers').update(updateData).eq('id', slip.customerId);
        }
      }
    }

    // 2. Format Currency Helper
    const formatKRW = (num: number) => num.toLocaleString('ko-KR') + '원';

    // 3. Email Dispatch via Resend
    if (channel === 'EMAIL') {
      if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ success: false, error: 'RESEND_API_KEY is not configured on the server.' }, { status: 500 });
      }

      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
          <h2 style="color: #2563eb; text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">거래명세서</h2>
          <p><strong>문서번호:</strong> ${slip.slipNo}</p>
          <p><strong>발행일자:</strong> ${slip.slipDate}</p>
          <p><strong>거래처:</strong> ${slip.customerName}</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1;">
                <th style="padding: 10px; text-align: left;">품목명</th>
                <th style="padding: 10px; text-align: right;">수량</th>
                <th style="padding: 10px; text-align: right;">단가</th>
                <th style="padding: 10px; text-align: right;">공급가액</th>
              </tr>
            </thead>
            <tbody>
              ${slip.items.map((item: any) => `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px;">${item.productName}</td>
                  <td style="padding: 10px; text-align: right;">${item.qty}</td>
                  <td style="padding: 10px; text-align: right;">${formatKRW(item.unitPrice)}</td>
                  <td style="padding: 10px; text-align: right;">${formatKRW(item.supplyAmount)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #f1f5f9; border-radius: 6px; text-align: right;">
            <p style="margin: 5px 0;"><strong>공급가액:</strong> ${formatKRW(slip.totalSupplyAmount)}</p>
            <p style="margin: 5px 0;"><strong>부가세:</strong> ${formatKRW(slip.totalTaxAmount)}</p>
            <h3 style="margin: 10px 0 0; color: #1e293b;">합계금액: ${formatKRW(slip.totalAmount)}</h3>
          </div>
          
          <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #64748b;">
            감사합니다. 또 이용해 주십시오.<br/>
            [전자서명/TSA 적용 문서]
          </p>
        </div>
      `;

      try {
        const data = await resend.emails.send({
          from: '명세서 발송 <onboarding@resend.dev>',
          to: [targetContact],
          subject: `[거래명세서] ${slip.customerName} 귀하 - ${slip.slipDate}`,
          html: emailHtml,
        });
        
        return NextResponse.json({ success: true, message: '이메일이 성공적으로 발송되었습니다.', data });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
    }

    // 4. KakaoTalk/SMS Dispatch via Solapi
    if (channel === 'KAKAO') {
      if (!process.env.SOLAPI_API_KEY || !process.env.SOLAPI_API_SECRET || !process.env.SOLAPI_SENDER_PHONE) {
        return NextResponse.json({ success: false, error: '솔라피(Solapi) API 키 또는 발신번호가 설정되지 않았습니다.' }, { status: 500 });
      }

      try {
        const { Message } = require('solapi').default || require('solapi');
        const messageService = new Message(process.env.SOLAPI_API_KEY, process.env.SOLAPI_API_SECRET);
        
        const text = `[거래명세서 발송 안내]\n\n${slip.customerName} 귀하\n발행일자: ${slip.slipDate}\n문서번호: ${slip.slipNo}\n합계금액: ${formatKRW(slip.totalAmount)}\n\n항상 이용해 주셔서 감사합니다.`;
        
        const response = await messageService.sendOne({
          to: targetContact.replace(/[^0-9]/g, ''),
          from: process.env.SOLAPI_SENDER_PHONE.replace(/[^0-9]/g, ''),
          text
        });

        return NextResponse.json({ success: true, message: '카카오톡/문자가 성공적으로 접수되었습니다.', data: response });
      } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message || '문자 발송 실패' }, { status: 500 });
      }
    }

    // 5. Fax Dispatch via Popbill
    if (channel === 'FAX') {
      if (!process.env.POPBILL_LINKID || !process.env.POPBILL_SECRET || !process.env.POPBILL_CORPNUM || !process.env.POPBILL_SENDER_FAX) {
        return NextResponse.json({ success: false, error: '팝빌(Popbill) 설정이 누락되었습니다. (.env.local 확인)' }, { status: 500 });
      }
      
      const fileBase64 = body.fileBase64;
      if (!fileBase64) {
        return NextResponse.json({ success: false, error: '팩스 전송을 위한 문서(PDF) 데이터가 없습니다.' }, { status: 400 });
      }

      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      
      const tempFilePath = path.join(os.tmpdir(), `slip_${slipId}_${Date.now()}.pdf`);
      
      try {
        // Save base64 to temp file
        fs.writeFileSync(tempFilePath, Buffer.from(fileBase64, 'base64'));

        const popbill = require('popbill');
        popbill.config({
          LinkID: process.env.POPBILL_LINKID,
          SecretKey: process.env.POPBILL_SECRET,
          IsTest: false
        });
        
        const faxService = popbill.FaxService();
        const corpNum = process.env.POPBILL_CORPNUM.replace(/[^0-9]/g, '');
        const senderFax = process.env.POPBILL_SENDER_FAX.replace(/[^0-9]/g, '');
        const receiverFax = targetContact.replace(/[^0-9]/g, '');

        const sendResult = await new Promise((resolve, reject) => {
          faxService.sendFAX(
            corpNum,
            senderFax,
            receiverFax,
            slip.customerName, // receiverName
            [tempFilePath], // FilePaths
            '', // ReserveDT
            '', // UserID
            '', // SenderName
            false, // AdsYN
            `명세서 발송_${slip.slipNo}`, // Title
            '', // RequestNum
            (receiptNum: string) => resolve({ receiptNum }),
            (err: any) => reject(err)
          );
        });

        // Clean up temp file
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

        return NextResponse.json({ success: true, message: '팩스 발송이 성공적으로 접수되었습니다.', data: sendResult });
      } catch (error: any) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        return NextResponse.json({ success: false, error: error.message || error.code || '팩스 전송 실패' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: false, error: 'Invalid channel' }, { status: 400 });
    
  } catch (error: any) {
    console.error('Dispatch API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
