import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Dashboard } from './components/Dashboard'
import { GameRoom } from './components/GameRoom'
import { LoginScreen } from './components/LoginScreen'
import { NicknameModal } from './components/NicknameModal'
import { WinnerModal } from './components/WinnerModal'
import { getPuzzle } from './data/puzzles'
import { gameApi, isSupabaseConfigured, supabase, type GameState, type SubmitResult } from './lib/game'
import { getKstDayNumber, getMillisecondsUntilNextKstMidnight } from './lib/kstClock'
import './App.css'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [inGame, setInGame] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [winnerNotice, setWinnerNotice] = useState<{ nickname: string } | null>(null)
  const profileNickname = state?.profile?.nickname

  const loadState = useCallback(async () => {
    try {
      setGlobalError(null)
      const next = await gameApi.state()
      setState(next)
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : '게임 정보를 불러오지 못했습니다.')
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
        setInGame(false)
        setWinnerNotice(null)
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

  useEffect(() => {
    const playDate = state?.round?.play_date
    if (!session || !profileNickname || !playDate) return

    let removed = false
    let syncing = false
    let syncQueued = false
    let wasSolved = Boolean(state.round?.solved_at)

    const syncRealtimeState = async () => {
      if (syncing) {
        syncQueued = true
        return
      }
      syncing = true
      do {
        syncQueued = false
        try {
          const next = await gameApi.state()
          if (removed) return

          const isSolved = Boolean(next.round?.solved_at)
          const justSolved = !wasSolved && isSolved
          wasSolved = isSolved
          setState(next)

          if (justSolved) {
            setWinnerNotice({
              nickname: next.round?.winner_nickname ?? '익명의 도전자',
            })
          }
        } catch {
          // The channel retries automatically; the next successful subscription resyncs state.
        }
      } while (syncQueued && !removed)
      syncing = false
    }

    const channel = supabase
      .channel('daily-round-' + playDate)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'daily_rounds',
          filter: 'play_date=eq.' + playDate,
        },
        (payload) => {
          const updatedRound = payload.new as { solved_at?: string | null }
          if (!wasSolved && updatedRound.solved_at) void syncRealtimeState()
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void syncRealtimeState()
      })

    return () => {
      removed = true
      void supabase.removeChannel(channel)
    }
  }, [session, profileNickname, state?.round?.play_date, state?.round?.solved_at])

  useEffect(() => {
    if (!session) return

    let timer: number
    let currentKstDay = getKstDayNumber()

    const refreshIfDateChanged = () => {
      const nextKstDay = getKstDayNumber()
      if (nextKstDay === currentKstDay) return
      currentKstDay = nextKstDay
      setInGame(false)
      void loadState()
    }

    const scheduleMidnightRefresh = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        refreshIfDateChanged()
        scheduleMidnightRefresh()
      }, getMillisecondsUntilNextKstMidnight() + 250)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      refreshIfDateChanged()
      scheduleMidnightRefresh()
    }

    scheduleMidnightRefresh()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
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

  const enter = async () => {
    setBusy(true)
    try {
      const next = state?.entry ? state : await gameApi.enter()
      setState(next)
      setInGame(true)
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : '입장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const buyHint = async (): Promise<string | null> => {
    setBusy(true)
    try {
      const next = await gameApi.hint((state?.entry?.hints_used ?? 0) + 1)
      setState(next)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : '힌트를 열지 못했습니다.'
    } finally {
      setBusy(false)
    }
  }

  const submit = async (answer: string): Promise<SubmitResult | null> => {
    setBusy(true)
    try {
      const result = await gameApi.submit(answer)
      setState(result.state)
      if (result.first_solver) {
        setWinnerNotice({
          nickname: result.state.profile?.nickname ?? '익명의 도전자',
        })
      }
      return result
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : '정답을 확인하지 못했습니다.')
      return null
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <main className='loading-screen'><div className='loader-piece' /><p>사건 파일을 준비하는 중...</p></main>
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

  const puzzle = getPuzzle(state.round?.puzzle_id ?? 1)

  return (
    <>
      {inGame
        ? <GameRoom state={state} puzzle={puzzle} busy={busy} onBack={() => setInGame(false)}
            onBuyHint={buyHint} onSubmit={submit} />
        : <Dashboard state={state} puzzle={puzzle} busy={busy} onEnter={enter} onLogout={logout} />}
      {globalError && (
        <div className='toast' role='alert'>
          {globalError}
          <button onClick={() => setGlobalError(null)} aria-label='닫기'>×</button>
        </div>
      )}
      {winnerNotice && (
        <WinnerModal nickname={winnerNotice.nickname} onClose={() => setWinnerNotice(null)} />
      )}
    </>
  )
}
