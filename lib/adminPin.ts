// 관리자 모드 PIN — 해시(SHA-256)만 설정(system_config.adminPinHash)에 저장한다. 화면 잠금용이며 서버가 막는 것은 아니다.
export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`unible-sale-admin:${pin}`));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
// «발송됨»: 팩스·이메일·카카오 중 하나라도 성공했는지
export const isDispatched = (s?: { faxStatus?: string; emailStatus?: string; kakaoStatus?: string } | null) =>
  !!s && (s.faxStatus === 'SUCCESS' || s.emailStatus === 'SUCCESS' || s.kakaoStatus === 'SUCCESS');
