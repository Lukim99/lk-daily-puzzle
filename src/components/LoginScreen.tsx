interface LoginScreenProps {
  configured: boolean
  busy: boolean
  onLogin: () => void
}

export function LoginScreen({ configured, busy, onLogin }: LoginScreenProps) {
  return (
    <main className='login-screen'>
      <section className='login-card puzzle-cut'>
        <div className='brand-mark' aria-hidden='true'><i /><i /><i /><i /></div>
        <p className='eyebrow'>ONE PUZZLE. ONE WINNER.</p>
        <h1>데일리<span>퍼즐</span></h1>
        <p className='login-copy'>매일 자정, 단 하나의 사건이 공개됩니다.<br />가장 먼저 진실에 도달하세요.</p>
        <div className='login-divider'><span>오늘의 게임에 참가</span></div>
        <button className='kakao-button' onClick={onLogin} disabled={!configured || busy}>
          <span className='kakao-symbol'>●</span>
          {busy ? '연결 중...' : '카카오로 시작하기'}
        </button>
        {!configured && <p className='config-warning'>Supabase 환경변수를 설정하면 로그인이 활성화됩니다.</p>}
        <p className='login-foot'>매일 00:00 KST 갱신 · 최초 정답자 상금 90%</p>
      </section>
    </main>
  )
}
