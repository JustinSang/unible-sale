-- ----------------------------------------------------------
-- MDB Tools - A library for reading MS Access database files
-- Copyright (C) 2000-2011 Brian Bruns and others.
-- Files in libmdb are licensed under LGPL and the utilities under
-- the GPL, see COPYING.LIB and COPYING files respectively.
-- Check out http://mdbtools.sourceforge.net
-- ----------------------------------------------------------

-- That file uses encoding UTF-8

CREATE TABLE [cmb_수정사유]
 (
	[id1]			Text (50) NOT NULL, 
	[n1]			Text (50)
);

CREATE TABLE [cmb_Find]
 (
	[id1]			Long Integer NOT NULL, 
	[No]			Long Integer
);

CREATE TABLE [Cmb_Search]
 (
	[id1]			Long Integer, 
	[text1]			Text (255), 
	[n1]			Long Integer, 
	[거래처id]			Long Integer, 
	[품목규격]			Text (255)
);

CREATE TABLE [cmb계산방법]
 (
	[id]			Long Integer NOT NULL, 
	[방법]			Text (50) NOT NULL, 
	[비고]			Text (255)
);

CREATE TABLE [Cmb국세청신고]
 (
	[id1]			Long Integer NOT NULL, 
	[s1]			Text (50)
);

CREATE TABLE [Cmb문서구분]
 (
	[문서구분id]			Long Integer NOT NULL, 
	[문서구분]			Text (50)
);

CREATE TABLE [cmb영수청구]
 (
	[id]			Long Integer NOT NULL, 
	[영수청구s]			Text (50)
);

CREATE TABLE [cmb입출금구분]
 (
	[id1]			Long Integer NOT NULL, 
	[입출금구분]			Text (50)
);

CREATE TABLE [cmb전표구분]
 (
	[구분id]			Byte NOT NULL, 
	[구분]			Text (50)
);

CREATE TABLE [cmb페이지수동]
 (
	[id1]			Long Integer NOT NULL, 
	[줄수]			Text (50)
);

CREATE TABLE [cmbNo1]
 (
	[id1]			Long Integer NOT NULL
);

CREATE TABLE [MSysPrint]
 (
	[Mid]			Long Integer NOT NULL, 
	[Mtop]			Currency, 
	[Mleft]			Currency, 
	[MBottom]			Currency, 
	[BNo]			Boolean NOT NULL, 
	[BLine]			Boolean NOT NULL, 
	[OFN_MVGA]			Memo/Hyperlink (255), 
	[Option1]			Text (255), 
	[Option2]			Text (255), 
	[OFN_MSse]			Text (255), 
	[OFN_MSAd]			Text (255), 
	[OF_T]			Text (255), 
	[OF_NT]			Text (255), 
	[OF_ET]			Text (255), 
	[B_Chk1]			Boolean NOT NULL, 
	[B_Chk2]			Boolean NOT NULL
);

CREATE TABLE [tb_계좌]
 (
	[id1]			Long Integer NOT NULL, 
	[은행]			Text (50), 
	[계좌번호]			Text (50), 
	[예금주]			Text (50), 
	[비고]			Text (255), 
	[분류]			Long Integer
);

CREATE TABLE [tb_CoWidth]
 (
	[id1]			Long Integer, 
	[FmName]			Text (50), 
	[CoName]			Text (50), 
	[CoWidth]			Long Integer, 
	[FmCoName]			Text (50), 
	[Default1]			Text (50), 
	[Hidden]			Boolean NOT NULL, 
	[Hidden_Default]			Boolean NOT NULL, 
	[option]			Boolean NOT NULL
);

CREATE TABLE [tb_Option]
 (
	[id1]			Long Integer NOT NULL, 
	[S1]			Text (255), 
	[B1]			Boolean NOT NULL, 
	[L1]			Long Integer, 
	[비고]			Text (255), 
	[S2]			Text (255)
);

CREATE TABLE [tb_Option_기준단가표매입단가]
 (
	[id1]			Long Integer NOT NULL, 
	[S1]			Text (255), 
	[B1]			Boolean NOT NULL, 
	[L1]			Long Integer, 
	[비고]			Text (255)
);

CREATE TABLE [tb_xml]
 (
	[id1]			Long Integer, 
	[dockey]			Long Integer, 
	[작성일]			Text (50), 
	[상호]			Text (50), 
	[등록번호]			Text (50), 
	[금액]			Text (50), 
	[세액]			Text (50), 
	[합계]			Text (50), 
	[문서구분]			Text (50), 
	[수정사유]			Text (50), 
	[proc_state]			Text (50), 
	[read_state]			Text (50), 
	[보낸날짜]			Text (50), 
	[국세청]			Text (50), 
	[이메일]			Text (50), 
	[문서작성]			Text (50), 
	[last_time]			Text (50), 
	[국세청클릭]			Text (50), 
	[국세청응답]			Text (50), 
	[국세청처리]			Text (50), 
	[submit_id]			Text (50), 
	[sinch_no]			Text (255), 
	[id2]			Long Integer
);

CREATE TABLE [tb_xml2]
 (
	[id1]			Long Integer, 
	[dockey]			Long Integer, 
	[작성일]			Text (50), 
	[상호]			Text (50), 
	[등록번호]			Text (50), 
	[금액]			Long Integer, 
	[세액]			Long Integer, 
	[합계]			Long Integer, 
	[문서구분]			Text (50), 
	[수정사유]			Text (50), 
	[proc_state]			Text (50), 
	[read_state]			Text (50), 
	[보낸날짜]			Text (50), 
	[국세청]			Text (50), 
	[이메일]			Text (50), 
	[문서작성]			Text (50), 
	[last_time]			Text (50), 
	[국세청클릭]			Text (50), 
	[국세청응답]			Text (50), 
	[국세청처리]			Text (50), 
	[submit_id]			Text (50), 
	[sinch_no]			Text (255), 
	[id2]			Long Integer, 
	[공급자등록번호]			Text (50), 
	[국세청승인번호]			Text (255), 
	[품목]			Text (255)
);

CREATE TABLE [tb거래처]
 (
	[거래처id]			Long Integer NOT NULL, 
	[상호]			Text (255), 
	[상호2]			Text (255), 
	[전화번호]			Text (50), 
	[전화번호2]			Text (50), 
	[팩스]			Text (50), 
	[EMail]			Text (255), 
	[EMail2]			Text (255), 
	[담당자]			Text (50), 
	[핸드폰]			Text (50), 
	[등록번호]			Text (50), 
	[성명]			Text (50), 
	[주소]			Text (255), 
	[업태]			Text (50), 
	[종목]			Text (50), 
	[비고]			Text (255), 
	[금액계산방법]			Long Integer NOT NULL, 
	[부가세계산방법]			Long Integer NOT NULL, 
	[세액계산]			Boolean NOT NULL, 
	[부가세종류]			Text (50), 
	[은행]			Text (50), 
	[계좌]			Text (50), 
	[예금주]			Text (50), 
	[우편번호]			Text (50), 
	[주소2]			Text (255), 
	[우편번호2]			Text (255), 
	[주민등록번호]			Text (50), 
	[원장전잔고]			Boolean NOT NULL, 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[마지막수정일]			DateTime, 
	[마지막수정시간]			DateTime, 
	[거래중단]			Boolean NOT NULL, 
	[체크요망]			Boolean NOT NULL, 
	[결재일]			Long Integer, 
	[계좌No]			Long Integer, 
	[원장기본계좌]			Boolean NOT NULL, 
	[원장계좌]			Long Integer, 
	[원장추가계좌]			Boolean NOT NULL, 
	[종사업자번호]			Text (50), 
	[매입매출]			Long Integer, 
	[거래처구분]			Text (50), 
	[거래처전잔고]			Currency
);

CREATE TABLE [tb거래처2]
 (
	[id1]			Long Integer, 
	[거래처id]			Long Integer, 
	[no1]			Long Integer, 
	[담당자]			Text (50), 
	[EMail]			Text (50), 
	[핸드폰]			Text (50), 
	[비고]			Text (255), 
	[전화번호]			Text (50)
);

CREATE TABLE [tb거래처2_Me]
 (
	[거래처id2]			Long Integer NOT NULL, 
	[전잔고]			Currency, 
	[입금]			Currency, 
	[출금]			Currency, 
	[매입가액]			Currency, 
	[매입세액]			Currency, 
	[매입합계]			Currency, 
	[매출가액]			Currency, 
	[매출세액]			Currency, 
	[매출합계]			Currency, 
	[입금건수]			Long Integer, 
	[출금건수]			Long Integer, 
	[매입건수]			Long Integer, 
	[매출건수]			Long Integer, 
	[총잔액]			Currency, 
	[구분]			Long Integer, 
	[세금매입가액]			Currency, 
	[세금매입세액]			Currency, 
	[세금매입합계]			Currency, 
	[세금매출가액]			Currency, 
	[세금매출세액]			Currency, 
	[세금매출합계]			Currency, 
	[차액매입가액]			Currency, 
	[차액매입세액]			Currency, 
	[차액매입합계]			Currency, 
	[차액매출가액]			Currency, 
	[차액매출세액]			Currency, 
	[차액매출합계]			Currency, 
	[면세매입합계]			Currency, 
	[면세매출합계]			Currency
);

CREATE TABLE [tb견적내역]
 (
	[전표내역id]			Long Integer, 
	[전표id]			Long Integer, 
	[품목id]			Text (255), 
	[품목]			Text (255), 
	[규격]			Text (255), 
	[수량]			Text (255), 
	[단가]			Text (255), 
	[금액]			Currency, 
	[세액]			Currency, 
	[합계]			Currency, 
	[비고]			Text (255), 
	[No1]			Long Integer, 
	[품목규격]			Text (255), 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[기준단가]			Text (50), 
	[할인율]			Currency, 
	[단위]			Text (50), 
	[비고화면]			Text (255), 
	[매입단가]			Text (50), 
	[매입금액]			Currency, 
	[마진율]			Currency
);

CREATE TABLE [tb국세청통계_Me]
 (
	[id1]			Long Integer NOT NULL, 
	[년월]			Text (50), 
	[반려]			Text (50), 
	[미신고]			Text (50), 
	[전송중]			Text (50), 
	[전송실패]			Text (50)
);

CREATE TABLE [tb문자]
 (
	[id1]			Long Integer, 
	[no]			Long Integer, 
	[문자]			Text (255), 
	[설명]			Text (255), 
	[선택]			Long Integer, 
	[전표id]			Long Integer
);

CREATE TABLE [tb발주]
 (
	[전표id]			Long Integer NOT NULL, 
	[전표날짜]			DateTime, 
	[거래처id]			Long Integer, 
	[세액계산]			Boolean NOT NULL, 
	[부가세종류]			Text (50), 
	[매입]			Currency, 
	[매입가액]			Currency, 
	[매입세액]			Currency, 
	[품목]			Text (255), 
	[비고]			Text (255), 
	[부가사항]			Memo/Hyperlink (255), 
	[전화번호]			Text (50), 
	[팩스]			Text (50), 
	[수신]			Text (50), 
	[제목]			Text (255), 
	[완료]			Boolean NOT NULL, 
	[명세서id]			Long Integer, 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[마지막수정일]			DateTime, 
	[마지막수정시간]			DateTime, 
	[발주No]			Text (50), 
	[이메일]			Text (50)
);

CREATE TABLE [tb재고_Me]
 (
	[재고id]			Long Integer, 
	[품목]			Text (255), 
	[규격]			Text (255), 
	[품목규격]			Text (255), 
	[전매입수량]			Currency, 
	[전매출수량]			Currency, 
	[매입수량]			Currency, 
	[매출수량]			Currency, 
	[Null1]			Text (50), 
	[전재고]			Currency, 
	[현재고]			Currency
);

CREATE TABLE [tb전표]
 (
	[전표id]			Long Integer NOT NULL, 
	[전표날짜]			DateTime, 
	[거래처id]			Long Integer, 
	[전표구분]			Byte, 
	[세액계산]			Boolean NOT NULL, 
	[부가세종류]			Text (50), 
	[매출]			Currency, 
	[매출가액]			Currency, 
	[매출세액]			Currency, 
	[매입]			Currency, 
	[매입가액]			Currency, 
	[매입세액]			Currency, 
	[수량합계]			Currency, 
	[품목]			Text (255), 
	[비고]			Text (255), 
	[비고2]			Text (255), 
	[bP]			Boolean NOT NULL, 
	[Page_No]			Long Integer, 
	[입금_Str]			Text (50), 
	[미수_Str]			Text (50), 
	[잔액_Str]			Text (50), 
	[입금_Txt]			Text (50), 
	[미수_Txt]			Currency, 
	[잔액_Txt]			Text (50), 
	[Time_Print]			DateTime, 
	[비고3_www]			Text (255), 
	[chk계산서]			Boolean NOT NULL, 
	[계산서id]			Long Integer, 
	[면세id]			Long Integer, 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[마지막수정일]			DateTime, 
	[마지막수정시간]			DateTime, 
	[잔액]			Currency, 
	[입출금구분]			Text (50), 
	[계좌]			Text (255), 
	[완료]			Boolean NOT NULL, 
	[Tax담당자]			Text (255), 
	[Tax핸드폰]			Text (255), 
	[Tax이메일]			Text (255), 
	[Tax이메일2]			Text (255), 
	[dockey]			Long Integer, 
	[전자발행]			Boolean NOT NULL, 
	[전자발행메모]			Text (255), 
	[proc_state]			Text (50), 
	[read_state]			Text (50), 
	[전자발행완료]			Boolean NOT NULL, 
	[문서구분id]			Long Integer, 
	[공급받는자등록번호]			Text (255), 
	[subkey]			Text (50)
);

CREATE TABLE [tb전표_Prt_Me]
 (
	[전표id1]			Long Integer NOT NULL, 
	[전표id]			Long Integer
);

CREATE TABLE [tb전표내역]
 (
	[전표내역id]			Long Integer, 
	[전표id]			Long Integer, 
	[품목날짜]			DateTime, 
	[품목id]			Text (255), 
	[품목]			Text (255), 
	[규격]			Text (255), 
	[수량]			Text (255), 
	[단가]			Text (255), 
	[금액]			Currency, 
	[세액]			Currency, 
	[합계]			Currency, 
	[비고]			Text (255), 
	[구분]			Byte, 
	[전표id1]			Long Integer, 
	[Len_F]			Long Integer, 
	[No1]			Long Integer, 
	[yy1]			Long Integer, 
	[mm1]			Long Integer, 
	[dd1]			Long Integer, 
	[매입수량]			Currency, 
	[매출수량]			Currency, 
	[품목규격]			Text (255), 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[기준단가]			Text (50), 
	[할인율]			Currency, 
	[Chk_면세]			Boolean NOT NULL, 
	[단위]			Text (50), 
	[비고화면]			Text (255), 
	[단가2]			Currency
);

CREATE TABLE [tb품목]
 (
	[품목id1]			Long Integer, 
	[품목id]			Text (255), 
	[품목]			Text (255), 
	[규격]			Text (255), 
	[매입단가]			Text (255), 
	[단가]			Text (255), 
	[세액]			Long Integer, 
	[비고]			Text (255), 
	[비고인쇄]			Text (255), 
	[단위]			Text (50), 
	[선택]			Boolean NOT NULL, 
	[품목규격]			Text (255), 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[마진율]			Currency, 
	[할인율1]			Currency, 
	[단가1]			Text (50), 
	[할인율2]			Currency, 
	[단가2]			Text (50), 
	[할인율3]			Currency, 
	[단가3]			Text (50), 
	[Chk_면세]			Boolean NOT NULL, 
	[분류1]			Text (255), 
	[분류2]			Text (255), 
	[분류3]			Text (255), 
	[화면번호]			Long Integer
);

CREATE TABLE [tb품목temp]
 (
	[id1]			Long Integer, 
	[품목id]			Text (255), 
	[품목]			Text (255), 
	[규격]			Text (255), 
	[매입단가]			Text (255), 
	[단가]			Text (255), 
	[비고]			Text (255), 
	[비고인쇄]			Text (255), 
	[단위]			Text (255), 
	[품목규격]			Text (255), 
	[chk_면세]			Boolean NOT NULL
);

CREATE TABLE [tb품목xls]
 (
	[kh1]			Long Integer, 
	[세액2]			Text (50), 
	[품목규격]			Text (255), 
	[Chk_면세]			Boolean NOT NULL, 
	[분류1]			Text (255), 
	[분류2]			Text (255), 
	[분류3]			Text (255), 
	[화면No]			Text (50), 
	[품목코드]			Text (255), 
	[품목]			Text (255), 
	[규격]			Text (255), 
	[단위]			Text (255), 
	[매입단가]			Text (255), 
	[마진율]			Text (50), 
	[매출단가]			Text (255), 
	[세액]			Text (50), 
	[비고인쇄]			Text (255), 
	[비고화면]			Text (255), 
	[할인율1]			Text (50), 
	[매출단가1]			Text (255), 
	[할인율2]			Text (50), 
	[매출단가2]			Text (255), 
	[할인율3]			Text (50), 
	[매출단가3]			Text (255), 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime
);

CREATE TABLE [tbBackUP_List]
 (
	[id1]			Long Integer, 
	[Name1]			Text (50), 
	[Count1]			Long Integer, 
	[Last1]			Text (50)
);

CREATE TABLE [tbNTax]
 (
	[Taxid]			Long Integer NOT NULL, 
	[거래처id]			Long Integer, 
	[매입매출]			Byte, 
	[작성일]			DateTime, 
	[공란수]			Integer, 
	[공급가액]			Currency, 
	[비고]			Text (255), 
	[비고2]			Text (255), 
	[영수청구]			Long Integer, 
	[금액계산방법]			Long Integer, 
	[품목]			Text (255), 
	[No1]			Long Integer, 
	[No2]			Long Integer, 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[마지막수정일]			DateTime, 
	[마지막수정시간]			DateTime, 
	[완료]			Boolean NOT NULL, 
	[공급자id]			Long Integer, 
	[공급받는자id]			Long Integer, 
	[계좌]			Long Integer, 
	[Tax이메일]			Text (255), 
	[Tax이메일2]			Text (255), 
	[Tax담당자]			Text (255), 
	[Tax핸드폰]			Text (255), 
	[공급자등록번호]			Text (50), 
	[공급받는자등록번호]			Text (50), 
	[dockey]			Long Integer, 
	[전자발행]			Boolean NOT NULL, 
	[전자발행메모]			Text (255), 
	[proc_state]			Text (50), 
	[read_state]			Text (50), 
	[국세청신고]			Long Integer, 
	[국세청결과]			Text (50), 
	[국세청완료]			Boolean NOT NULL, 
	[subkey]			Text (50), 
	[종사업자번호]			Text (50), 
	[NTS_issue_id]			Text (255), 
	[문서구분id]			Long Integer
);

CREATE TABLE [tbNTaxs]
 (
	[TaxSid]			Long Integer, 
	[Taxid]			Long Integer, 
	[MM]			Text (50), 
	[DD]			Text (50), 
	[품목]			Text (255), 
	[규격]			Text (255), 
	[수량]			Text (255), 
	[단가]			Text (255), 
	[공급가액]			Currency, 
	[비고]			Text (255), 
	[품목규격]			Text (255), 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[단위]			Text (50)
);

CREATE TABLE [tbSum_Me]
 (
	[거래처id]			Long Integer NOT NULL, 
	[공급가액총계]			Currency, 
	[세액총계]			Currency, 
	[합계총계]			Currency, 
	[합계개수]			Currency, 
	[전잔고]			Currency, 
	[입금]			Currency, 
	[입금건수]			Currency, 
	[출금]			Currency, 
	[출금건수]			Currency, 
	[매입가액]			Currency, 
	[매입세액]			Currency, 
	[매입합계]			Currency, 
	[매입건수]			Currency, 
	[매출가액]			Currency, 
	[매출세액]			Currency, 
	[매출합계]			Currency, 
	[매출건수]			Currency, 
	[매입면세]			Currency, 
	[매출면세]			Currency
);

CREATE TABLE [tbTax]
 (
	[Taxid]			Long Integer NOT NULL, 
	[거래처id]			Long Integer, 
	[매입매출]			Byte, 
	[작성일]			DateTime, 
	[공란수]			Integer, 
	[공급가액]			Currency, 
	[세액]			Currency, 
	[합계]			Currency, 
	[비고]			Text (255), 
	[비고2]			Text (255), 
	[영수청구]			Long Integer, 
	[금액계산방법]			Long Integer, 
	[부가세계산방법]			Long Integer, 
	[품목]			Text (255), 
	[No1]			Long Integer, 
	[No2]			Long Integer, 
	[영세율]			Boolean NOT NULL, 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[마지막수정일]			DateTime, 
	[마지막수정시간]			DateTime, 
	[완료]			Boolean NOT NULL, 
	[공급자id]			Long Integer, 
	[공급받는자id]			Long Integer, 
	[계좌]			Long Integer, 
	[Tax이메일]			Text (255), 
	[Tax이메일2]			Text (255), 
	[Tax담당자]			Text (255), 
	[Tax핸드폰]			Text (255), 
	[공급자등록번호]			Text (50), 
	[공급받는자등록번호]			Text (50), 
	[종사업자번호]			Text (50), 
	[dockey]			Long Integer, 
	[전자발행]			Boolean NOT NULL, 
	[전자발행메모]			Text (255), 
	[proc_state]			Text (50), 
	[read_state]			Text (50), 
	[국세청신고]			Long Integer, 
	[국세청결과]			Text (50), 
	[국세청완료]			Boolean NOT NULL, 
	[subkey]			Text (50), 
	[NTS_issue_id]			Text (255), 
	[문서구분id]			Long Integer
);

CREATE TABLE [tbTaxs]
 (
	[TaxSid]			Long Integer, 
	[Taxid]			Long Integer, 
	[MM]			Text (50), 
	[DD]			Text (50), 
	[품목]			Text (255), 
	[규격]			Text (255), 
	[수량]			Text (255), 
	[단가]			Text (255), 
	[공급가액]			Currency, 
	[세액]			Currency, 
	[합계]			Currency, 
	[비고]			Text (255), 
	[품목규격]			Text (255), 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[단위]			Text (50), 
	[비고화면]			Text (255)
);

CREATE TABLE [tbTitle]
 (
	[id1]			Long Integer NOT NULL, 
	[Title1]			Text (50), 
	[BKdate1]			DateTime, 
	[sStart]			Text (50), 
	[ver1]			Currency
);

CREATE TABLE [tbTitle3]
 (
	[id1]			Long Integer NOT NULL, 
	[Title1]			Text (50), 
	[BKdate1]			DateTime, 
	[sStart]			Text (50), 
	[ver1]			Currency
);

CREATE TABLE [Cmb국세청결과]
 (
	[id1]			Text (255) NOT NULL, 
	[s1]			Text (255), 
	[s2]			Text (255), 
	[s3]			Text (50)
);

CREATE TABLE [cmb전표내역구분]
 (
	[구분id]			Byte NOT NULL, 
	[구분]			Text (50)
);

CREATE TABLE [tb_dockey_Me]
 (
	[tbdockey]			Long Integer NOT NULL, 
	[proc_state]			Text (50), 
	[read_state]			Text (50), 
	[국세청결과]			Text (50), 
	[국세청완료]			Boolean NOT NULL, 
	[작성일]			Text (50), 
	[품목]			Text (255), 
	[상호]			Text (50), 
	[등록번호]			Text (50), 
	[합계]			Text (50), 
	[문서구분]			Text (50), 
	[문서구분id]			Long Integer
);

CREATE TABLE [tb거래처1]
 (
	[거래처id]			Long Integer NOT NULL, 
	[상호]			Text (255), 
	[상호2]			Text (255), 
	[전화번호]			Text (50), 
	[전화번호2]			Text (50), 
	[팩스]			Text (50), 
	[EMail]			Text (255), 
	[EMail2]			Text (255), 
	[담당자]			Text (50), 
	[핸드폰]			Text (50), 
	[등록번호]			Text (50), 
	[성명]			Text (50), 
	[주소]			Text (255), 
	[업태]			Text (50), 
	[종목]			Text (50), 
	[비고]			Text (255), 
	[금액계산방법]			Long Integer NOT NULL, 
	[부가세계산방법]			Long Integer NOT NULL, 
	[세액계산]			Boolean NOT NULL, 
	[부가세종류]			Text (50), 
	[은행]			Text (50), 
	[계좌]			Text (50), 
	[예금주]			Text (50), 
	[우편번호]			Text (50), 
	[주소2]			Text (255), 
	[우편번호2]			Text (255), 
	[주민등록번호]			Text (50), 
	[원장전잔고]			Boolean NOT NULL, 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[마지막수정일]			DateTime, 
	[마지막수정시간]			DateTime, 
	[거래중단]			Boolean NOT NULL, 
	[체크요망]			Boolean NOT NULL, 
	[결재일]			Long Integer, 
	[계좌No]			Long Integer, 
	[원장기본계좌]			Boolean NOT NULL, 
	[원장계좌]			Long Integer, 
	[원장추가계좌]			Boolean NOT NULL, 
	[종사업자번호]			Text (50), 
	[매입매출]			Long Integer, 
	[거래처구분]			Text (50), 
	[거래처전잔고]			Currency
);

CREATE TABLE [tb견적]
 (
	[전표id]			Long Integer NOT NULL, 
	[전표날짜]			DateTime, 
	[거래처id]			Long Integer, 
	[세액계산]			Boolean NOT NULL, 
	[부가세종류]			Text (50), 
	[매출]			Currency, 
	[매출가액]			Currency, 
	[매출세액]			Currency, 
	[품목]			Text (255), 
	[비고]			Text (255), 
	[부가사항]			Memo/Hyperlink (255), 
	[전화번호]			Text (50), 
	[팩스]			Text (50), 
	[수신]			Text (50), 
	[제목]			Text (255), 
	[완료]			Boolean NOT NULL, 
	[명세서id]			Long Integer, 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[마지막수정일]			DateTime, 
	[마지막수정시간]			DateTime, 
	[견적No]			Text (50), 
	[이메일]			Text (255), 
	[매입금액]			Currency
);

CREATE TABLE [tb발주내역]
 (
	[전표내역id]			Long Integer, 
	[전표id]			Long Integer, 
	[품목id]			Text (255), 
	[품목]			Text (255), 
	[규격]			Text (255), 
	[수량]			Text (255), 
	[단가]			Text (255), 
	[금액]			Currency, 
	[세액]			Currency, 
	[합계]			Currency, 
	[비고]			Text (255), 
	[No1]			Long Integer, 
	[품목규격]			Text (255), 
	[만든날짜]			DateTime, 
	[만든시간]			DateTime, 
	[기준단가]			Text (50), 
	[할인율]			Currency, 
	[단위]			Text (50), 
	[비고화면]			Text (255), 
	[매입단가]			Text (50), 
	[매입금액]			Currency, 
	[마진율]			Currency
);

CREATE TABLE [tbTitle2]
 (
	[id1]			Long Integer NOT NULL, 
	[Title1]			Text (50), 
	[BKdate1]			DateTime, 
	[sStart]			Text (50), 
	[ver1]			Currency
);


