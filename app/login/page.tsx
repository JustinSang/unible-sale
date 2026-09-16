// app/login/page.tsx
'use client'

export default function LoginPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      {/* Windows XP 스타일 다이얼로그 박스 */}
      <div className="dialog-box" style={{ width: '300px' }}>
        <div className="dialog-title">로그인</div>
        
        <div style={{ padding: '10px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label className="label-xp" style={{ display: 'block', marginBottom: '4px' }}>사용자 이름:</label>
            <input type="text" className="input-xp" style={{ width: '100%' }} />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label className="label-xp" style={{ display: 'block', marginBottom: '4px' }}>암호:</label>
            <input type="password" className="input-xp" style={{ width: '100%' }} />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '5px' }}>
            <button className="btn-xp">확인 Enter</button>
            <button className="btn-xp">취소 Esc</button>
          </div>
        </div>
      </div>
    </div>
  )
}