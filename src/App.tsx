import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LoginScreen } from './components/LoginScreen'
import { NicknameModal } from './components/NicknameModal'
import { MakeLineRoom } from './components/MakeLineRoom'
import { gameApi, isSupabaseConfigured, supabase, type GameState } from './lib/game'
import './App.css'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  const loadState = useCallback(async () => {
    try {
      setGlobalError(null)
      const next = await gameApi.state()
      setState(next)
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : '정보를 불러오지 못했습니다.')
    }
  }, [])

  useEffect(() => {
    let active = true
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    gameApi.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setState(null)
        setPlaying(false)
        setLoading(false)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    loadState().finally(() => setLoading(false))
  }, [session, loadState])

  const login = async () => {
    setBusy(true)
    const { error } = await gameApi.login()
    if (error) setGlobalError(error.message)
    setBusy(false)
  }

  const logout = async () => {
    setBusy(true)
    await gameApi.logout()
    setBusy(false)
  }

  const linkNickname = async (nickname: string): Promise<string | null> => {
    setBusy(true)
    try {
      const result = await gameApi.linkNickname(nickname)
      if (result.status === 'not_found') return '포인트 상점 계정이 존재하지 않습니다.'
      if (result.status === 'already_linked') return '이미 연동된 다른 카카오 계정이 있습니다.'
      if (result.status === 'auth_already_linked') return '이 카카오 계정은 이미 다른 닉네임과 연동되어 있습니다.'
      await loadState()
      return null
    } catch (error) {
      return error instanceof Error ? error.message : '연결하지 못했습니다.'
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <main className='loading-screen'><div className='loader-piece' /><p>불러오는 중...</p></main>
  }

  if (!session) {
    return (
      <>
        <LoginScreen configured={isSupabaseConfigured} busy={busy} onLogin={login} />
        {globalError && <div className='toast' role='alert'>{globalError}</div>}
      </>
    )
  }

  if (!state?.profile) {
    return (
      <main className='login-screen dimmed'>
        <div className='wordmark splash-wordmark'>◆ 데일리퍼즐</div>
        <NicknameModal busy={busy} onSubmit={linkNickname} onLogout={logout} />
      </main>
    )
  }

  if (playing && session.user) {
    return <MakeLineRoom userId={session.user.id} onExit={() => setPlaying(false)} />
  }

  return (
    <>
      <main className='home-screen'>
        <header className='home-topbar'>
          <div className='wordmark'><span className='mini-piece'>◆</span> 데일리퍼즐</div>
          <button className='profile-button' onClick={logout} aria-label='로그아웃'>
            {state.profile.nickname.slice(0, 1)}
          </button>
        </header>

        <section className='home-body'>
          <div className='service-ended puzzle-cut'>
            <p className='eyebrow'>SERVICE CLOSED</p>
            <h1>데일리 퍼즐 종료</h1>
            <p className='service-ended-copy'>
              그동안 데일리 퍼즐을 즐겨주셔서 감사합니다.
            </p>
          </div>

          <article className='makeline-card puzzle-cut'>
            <p className='eyebrow'>NEW · 실시간 대전</p>
            <h2>메이크라인</h2>
            <p className='makeline-copy'>
              3×3 판 위에서 돌을 한 칸씩 옮겨 자기 돌 세 개를 한 줄로 잇는 사람이 이깁니다.
              상대와 실시간으로 매칭됩니다.
            </p>
            <div className='makeline-preview' aria-hidden='true'>
              <i className='stone-B' /><i className='stone-W' /><i className='stone-B' />
              <i /><i /><i />
              <i className='stone-W' /><i className='stone-B' /><i className='stone-W' />
            </div>
            <button className='primary-button' onClick={() => setPlaying(true)}>
              대전 시작 <span>→</span>
            </button>
          </article>
        </section>
      </main>
      {globalError && (
        <div className='toast' role='alert'>
          {globalError}
          <button onClick={() => setGlobalError(null)} aria-label='닫기'>×</button>
        </div>
      )}
    </>
  )
}
