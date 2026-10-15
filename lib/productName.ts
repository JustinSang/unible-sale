// 원본 품명 규칙: «{…}» 안의 글자는 전표·출력에서 제외한다(예 «볼트{중국제}» → «볼트»). 같은 품명을 관리용으로 구분할 때 쓴다.
export const displayProductName = (name: string) => String(name || '').replace(/\{[^}]*\}/g, '').trim();
