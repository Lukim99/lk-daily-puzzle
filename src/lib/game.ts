import { createClient, type Session } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

export const isSupabaseConfigured = Boolean(url && key)
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder',
)

export interface GameState {
  profile: { nickname: string; balance: number } | null
  round?: {
    play_date: string
    puzzle_id: number
    prize_pool: number
    solved_at: string | null
    winner_nickname: string | null
  }
  entry?: { hints_used: number; solved_at: string | null } | null
}

export interface SubmitResult {
  correct: boolean
  first_solver?: boolean
  awarded_points?: number
  state: GameState
}

function readableError(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String(error.message)
      : String(error)
  if (message.includes('INSUFFICIENT_BALANCE')) return '포인트가 부족합니다.'
  if (message.includes('HINTS_CLOSED')) return '오늘의 최초 정답자가 나와 힌트 구매가 종료되었습니다.'
  if (message.includes('ENTRY_REQUIRED')) return '퍼즐에 먼저 입장해 주세요.'
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

async function rpc<T>(name: string, params?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(readableError(error))
  return data as T
}

export const gameApi = {
  getSession: (): Promise<{ data: { session: Session | null } }> => supabase.auth.getSession(),
  login: () => supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: window.location.origin },
  }),
  logout: () => supabase.auth.signOut({ scope: 'local' }),
  state: () => rpc<GameState>('get_game_state'),
  linkNickname: (nickname: string) =>
    rpc<{ status: string }>('link_nickname', { p_nickname: nickname }),
  enter: () => rpc<GameState>('enter_today_puzzle'),
  hint: (index: number) => rpc<GameState>('buy_hint', { p_hint_index: index }),
  submit: (answer: string) =>
    rpc<SubmitResult>('submit_solution', { p_answer: answer }),
}
