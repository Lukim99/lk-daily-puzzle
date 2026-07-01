import { type FormEvent, useState } from 'react'
import { Modal } from './Modal'

interface NicknameModalProps {
  busy: boolean
  onSubmit: (nickname: string) => Promise<string | null>
  onLogout: () => void
}

export function NicknameModal({ busy, onSubmit, onLogout }: NicknameModalProps) {
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!nickname.trim()) return
    setError(await onSubmit(nickname.trim()))
  }

  return (
    <Modal eyebrow='FIRST CONNECTION' title='포인트 상점 계정을 연결하세요'>
      <p className='modal-copy'>카카오 계정과 연결할 기존 닉네임을 입력해 주세요. 연결은 한 번만 가능합니다.</p>
      <form onSubmit={submit} className='modal-form'>
        <label htmlFor='nickname'>포인트 상점 닉네임</label>
        <input id='nickname' value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder='닉네임 입력' maxLength={24} autoFocus />
        {error && <p className='form-error' role='alert'>{error}</p>}
        <button className='primary-button' disabled={busy || !nickname.trim()}>
          {busy ? '확인 중...' : '계정 연결하기'}
        </button>
      </form>
      <button className='text-button' onClick={onLogout}>다른 카카오 계정으로 로그인</button>
    </Modal>
  )
}
