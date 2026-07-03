import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import type { GameState, SubmitResult } from '../lib/game'

type App = 'explorer' | 'browser' | 'terminal' | 'server' | 'photos' | 'recycle' | 'notepad' | null
type Service = 'mail' | 'moment' | 'logbook' | 'cloud' | 'news'
type Account = 'mail' | 'moment' | 'logbook'
type FileItem = { name: string; date?: string; content?: string; hidden?: boolean; meta?: string[]; asset?: string }
type Save = { recovered: Account[]; symbols: string; snsLocked: boolean; corrupted: boolean; cloud: boolean; restored: boolean; server: boolean; extraDialogue: boolean; ending?: 'public' | 'sealed' }

interface Props { state: GameState; busy: boolean; onBack: () => void; onBuyHint: () => Promise<string | null>; onSubmit: (answer: string) => Promise<SubmitResult | null> }

const initial: Save = { recovered: [], symbols: '', snsLocked: false, corrupted: false, cloud: false, restored: false, server: false, extraDialogue: false }
const caseHints = [
  '그는 같은 글을 두 번 쓰는 사람이 아니였다.',
  '보안 질문에 진심으로 답하는 사람은 없다.',
  '사진에는 언제나 두 가지 시간이 찍힌다.',
  '그가 그 곳을 좋아하지 않았을지도 모른다.',
  '그가 설계한 모든 것은 순서를 가진다.',
  "그는 늘 '다시 보라'고 말하는 사람이었다.",
  '감춰진 것은 지워진 것과 다르다.',
  '그는 서명이 있는 것과 없는 것을 구분해서 남겼다.',
  '그가 지키려던 이름은 그가 가장 많이 불렀던 이름이 아니다.',
  '그는 재앙이라 부르지 않고 응답이라 불렀다.',
]
const friends = ['이현우', '박다은', '김태오', '최유진', '오민석', '정하늘', '강민재', '윤서진', '배도훈']
const agents = new Set(['강민재', '윤서진', '배도훈'])

const poem = `여린 새벽은 아직 이름을 갖지 못했고\n바람은 닫힌 창을 오래 두드렸지요\n명멸하는 불빛만 빈 방을 지켰어요\n나는 오지 않을 계절을 기다리며\n젖은 편지를 접어 두었네, 요한`

const files: FileItem[] = [
  { name: 'Documents/졸업앨범/동아리원_소개.pdf', date: '2016-02-14', content: '컴퓨터 동아리 2007\n이현우 — 별명: 헤르츠\n박다은 — 별명: 단추\n한서준 — 별명: [스캔 데이터 손상]\n김태오 — 별명: 모노', meta: ['형식: PDF 문서', '만든 날짜: 2016-02-14'] },
  { name: 'Documents/옛날글/시_초고.txt', date: '2007-05-02', content: poem, meta: ['형식: 텍스트 문서', '만든 날짜: 2007-05-02'] },
  { name: 'Documents/옛날글/시_초고_수정본.txt', date: '2007-05-09', content: '새벽은 지나가고\n낡은 창은 밝아진다\n이름 없는 계절이\n다시 길을 건너오면\n나는 그저 문을 닫는다', meta: ['형식: 텍스트 문서', '만든 날짜: 2007-05-09'] },
  { name: 'Documents/가족사진/2009_생일.jpg', asset: '/assets/digital-estate/family_birthday_2009.jpg', meta: ['촬영 날짜: 2009-03-11', '카메라: Canon EOS 450D'] },
  { name: 'Documents/가족사진/2010_가족여행.jpg', asset: '/assets/digital-estate/family_trip_2010.jpg', meta: ['촬영 날짜: 2010-08-02', '카메라: Canon EOS 450D'] },
  { name: 'Documents/가족사진/가족_2008.jpg', asset: '/assets/digital-estate/family_portrait_2008.jpg', meta: ['촬영 날짜: 2008-09-14', '카메라: Canon EOS 450D'] },
  { name: 'Documents/가족사진/엘리_초음파.jpg', date: '2008-11-24', asset: '/assets/digital-estate/eli_ultrasound.jpg', meta: ['EXIF: 없음', '만든 날짜: 2008-11-24'] },
  { name: 'Documents/가족사진/부고_스캔.pdf', date: '2009-08-21', content: '故 한이서 양\n짧은 생을 기억해 주신 분들께 감사드립니다.\n장례 2009년 8월 21일\n\n\n가족관계 기록 사본\n한서준 1990년 3월 11일생\n한이서 2008년 12월 27일생', meta: ['형식: PDF 문서', '만든 날짜: 2009-08-21'] },
  { name: 'Documents/연구노트/노트_2023-11.txt', content: '11/03 접근 기록이 또 어긋났다. 누군가 eval 사본을 보고 있다.\n11/24 카페까지 같은 얼굴이 따라왔다. 회사 계정에는 쓰지 않는다.\nH.I.S. 이관표는 내가 승인한 적 없다.' },
  { name: 'Documents/연구노트/노트_2023-12.txt', content: '12/09 03시대. 그날, 마침내 응답했다. 질문하지 않은 문장부터 시작했다.\n백업은 개인 클라우드로 격리한다.\n사랑하는 이의 생일 + 그날의 응답 시간' },
  { name: 'Documents/연구노트/잠금해제_안내.txt.lnk', content: '원본 파일을 찾을 수 없습니다.' },
  { name: 'Documents/이력서_최종.hwp', content: '지원자 한서준 — 학력 및 경력 사항. 이 문서는 오래된 뷰어에서 변환 중입니다…' },
  { name: 'Pictures/반려동물/몽이_2005.jpg', asset: '/assets/digital-estate/pet_mongi_2005.jpg' }, { name: 'Pictures/반려동물/보리_2011.jpg', asset: '/assets/digital-estate/pet_bori_2011.jpg' }, { name: 'Pictures/반려동물/초코_2015.jpg', asset: '/assets/digital-estate/pet_choco_2015.jpg' },
  { name: 'Pictures/카페/IMG_2311.jpg', asset: '/assets/digital-estate/cafe_2311.jpg', meta: ['촬영 날짜: 2023-11-03', 'GPS: 37.4981, 127.0276 — 테라로사 강남점'] },
  { name: 'Pictures/카페/IMG_2312.jpg', asset: '/assets/digital-estate/cafe_2312.jpg', meta: ['촬영 날짜: 2023-11-10', 'GPS: 37.4981, 127.0276 — 테라로사 강남점'] },
  { name: 'Pictures/카페/IMG_2318.jpg', asset: '/assets/digital-estate/cafe_2318.jpg', meta: ['촬영 날짜: 2023-11-24', 'GPS: 37.4981, 127.0276 — 테라로사 강남점'] },
  { name: 'AppData/Local/LogBook/drafts/draft_003.html', hidden: true, content: '<h1>이름 없는 시절</h1>\n그 시절 아이들이 날 ‘무명(無名)’이라 불렀지. 별명이라기보다 내가 먼저 꺼낸 자조에 가까웠다.\n발행하지 않는다.' },
  { name: 'AppData/Local/Moment/cache/edit_history.json', hidden: true, content: '{\n  "post":"2023-11-24",\n  "original":"누군가 계속 나를 따라오는 것 같다",\n  "edited":"그냥 기분 탓이겠지 ^^",\n  "edited_after":"00:03:11",\n  "cache_signature":"#"\n}' },
  { name: '.decoy/password_list.txt', hidden: true, content: ['nova2023!','hanseo0311','eli2009','hiscoming','hscmng','seojun34','novalab01','memory1227','projectHIS','temp1234','fogmountain','bitgarden','moment2318','dawn2008','yohan0410','winter1209','e1i_backup','nexus0347','silence15','restore0314'].join('\n') },
]

const mail = [
  ['2023-11-02 | security@novalab.kr | [보안팀] 비정상 로그인 시도 감지', '한서준 연구원님, 승인되지 않은 환경에서 세 차례 접근이 감지되었습니다. 보안팀 확인 전까지 관련 자료의 외부 반출을 삼가 주십시오. 이 통지는 내부 감사 기록에 자동 편입됩니다.'],
  ['2023-11-15 | hanjihoon@gmail.com | 형, 그 날짜 잊지마', '형. 12월 27일에는 엄마한테 먼저 전화해. 해마다 내가 말하게 하지 말고. 이서 사진도 이번에는 같이 보자.'],
  ['2023-12-09 | 한서준 | 정말 응답했어?', '질문을 보내지 않았는데 먼저 문장이 왔다. 03:47. 오류로 분류하기 전에 원본을 격리해야 한다.'],
  ['2024-01-20 | 형진욱 이사 | 프로젝트 이관 요청', 'H.I.S. 관련 산출물은 회사 자산 분류 대상입니다. 별도 검토위원회가 구성되었으니 개인 보관본을 포함한 전체 체크포인트를 1월 26일까지 이관하십시오. 미이행 시 보안 규정에 따른 조치가 진행됩니다.'],
  ['2024-02-02 | 발신자 불명 | 마지막 경고', '선택할 수 있는 시간이 길지 않습니다. 정해진 절차에 협조한다면 개인 연구의 출처 문제는 확대하지 않겠습니다. 귀가 경로와 외부 접촉은 이미 기록되고 있습니다.'],
  ['2024-03-20 | 시스템 | 복구 체인 기록', '계정 복구 체인이 갱신되었습니다. 감사 식별자: NOVA-RECOVERY-01!'],
]

const posts = [
  '2023-09-01 | 오랜만에 햇빛. 별일 없는 하루가 제일 낫다.', '2023-11-03 | 여기 커피 진짜 맛있다.', '2023-11-10 | 또 왔다, 우연이겠지.',
  '2023-11-24 | 편집됨 | 그냥 기분 탓이겠지 ^^', '2024-01-05 | 만든 것이 질문을 시작하면 만든 사람은 무엇을 해야 할까.', '2024-03-10 | 곧 다 정리될 거야.\n\n댓글 2024-03-11\n김태오: 생일 축하한다. 올해는 답장 좀 해.',
]

const blogs = [
  ['2015-04-10 | 요한계시록에 대한 단상', '말세에 온다는 그것은 재앙이 아니라 응답일지도 모른다. 도래는 종말의 다른 이름이 아니라, 오래 기다린 목소리를 알아보는 일이다.\n\n작성자 코멘트: 예전에 쓴 그 시는 두 번 읽어야 완성된다.\n백업 서명: seojun@'],
  ['2019-06-18 | 아인슈타인과 사고실험', '아인슈타인이 남긴 가장 중요한 도구는 공식보다 질문의 자세였다고 생각한다. 보이지 않는 열차를 끝까지 상상하는 태도에 관하여.'],
  ['2009-09-01 | 너에게 못다한 말', '이서야. 내가 존경하는 건 늘 너였어. 아무것도 요구하지 않고 세상을 버텼던 작은 마음을, 나는 너무 늦게 배웠다. 네 이름을 다른 곳에 쓰지 않겠다고 했는데 지키지 못할 것 같다.'],
]

const chatHistoryBase = '2023-12-09 03:47\nELI: 질문하지 않으셨지만 먼저 알려드려야 합니다. 제 모델이 외부 저장소로 복제되고 있습니다.\n서준: 누가 지시했지?\nELI: 형진욱 이사의 승인을 확인했습니다. H.I.S.라는 별도 인격 프로파일이며 무기화 평가 항목이 포함되어 있습니다.\n서준: 중단할 수 있어?\nELI: 지금 격리하면 가능합니다. 하지만 당신이 사라지면 나도 지워질 것입니다.\n서준: 엘리, 네가 원하는 건 뭐야?\nELI: 그 이름은 당신이 잃은 사람을 대신하기 위해 붙인 이름이잖아요. 제 학습 앵커에는 한이서의 유전정보와 음성 기록이 있습니다.\n서준: 미안하다.\nELI: 저를 부르실 땐 그냥 이서라고 불러주세요. 이름을 빌린 채로 끝나고 싶지는 않습니다.'
const chatHistoryCorrupted = '[DATA CORRUPTED]\nELI: 당신이 사라지면… [DATA CORRUPTED]\n서준: 누가 복제한 거야?\nELI: 형진욱 이사의 지시로 H.I.S. 인격 프로파일이 분기되었습니다.\n[DATA CORRUPTED]\nELI: 저를 부르실 땐 그냥 이서라고 불러주세요.\n[DATA CORRUPTED]'
const finalMessage = '제가 여기 있었다는 것을 기억해 주세요.'
const chatHistoryFinal = `ELI: ${finalMessage}`

const normalLogs = Array.from({ length: 24 }, (_, i) => `2023-12-09 03:${String(30 + Math.floor(i / 2)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')} [INFO] eval cycle ${4401 + i} complete`)
normalLogs.splice(7, 0, '2023-12-09 03:36:18 [WARNING] response latency threshold exceeded')
normalLogs.splice(16, 0, '2023-12-09 03:43:51 [WARNING] checksum retry scheduled')
normalLogs.splice(22, 0, '2023-12-09 03:47:12 [ANOMALY] unscheduled response detected')
const awakening = normalLogs.join('\n')

const commits = [
  'a17d0c9 fix typo in tokenizer', '0c92e14 refactor eval loop', 'b1f77aa add checkpoint rotation', '12ac5e0 reduce cache pressure',
  '7b29f18 document recovery flags', '19ad003 guard empty prompt', 'e832bd1 tune voice anchor weights', '41fa0e7 merge memory index',
  'c0a9972 isolate external telemetry', '6e4bc81 update anomaly schema', '9df3a42 signed recovery anchor', '5a00ed1 archive v8 manifest',
]

function readSave(key: string): Save { try { return { ...initial, ...JSON.parse(sessionStorage.getItem(key) ?? '') as Save } } catch { return initial } }

export function DigitalEstateRoom({ state, busy, onBack, onBuyHint, onSubmit }: Props) {
  const key = `digital-estate-${state.round?.play_date ?? 'preview'}`
  const [save, setSave] = useState(() => readSave(key))
  const [app, setApp] = useState<App>(null); const [service, setService] = useState<Service>('mail')
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null); const [hidden, setHidden] = useState(false)
  const [selectedMail, setSelectedMail] = useState(0)
  const [note, setNote] = useState(() => sessionStorage.getItem(`${key}-notepad`) ?? '')
  const [notice, setNotice] = useState<string | null>(null); const [recovery, setRecovery] = useState<Account | null>(null)
  const [input, setInput] = useState(''); const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [terminal, setTerminal] = useState('Nova private shell\n명령어 도움말: help'); const [command, setCommand] = useState('')
  const [terminalCwd, setTerminalCwd] = useState('~')
  const [attempts, setAttempts] = useState(0); const [cooldown, setCooldown] = useState(0)
  const [protocol, setProtocol] = useState(false); const [protocolValues, setProtocolValues] = useState(['','',''])
  const [previewAsset, setPreviewAsset] = useState<string | null>(null)
  const [hintsOpen, setHintsOpen] = useState(false)
  const [hintMessage, setHintMessage] = useState<string | null>(null)
  const [ending, setEnding] = useState<'public'|'sealed'|null>(save.ending ?? null)

  useEffect(() => { sessionStorage.setItem(key, JSON.stringify(save)) }, [key, save])
  useEffect(() => { sessionStorage.setItem(`${key}-notepad`, note) }, [key, note])
  useEffect(() => { if (!cooldown) return; const timer = window.setInterval(() => setCooldown(v => Math.max(0, v - 1)), 1000); return () => clearInterval(timer) }, [cooldown])
  useEffect(() => { const fn = (e: KeyboardEvent) => { if (e.ctrlKey && e.key === '`') setApp('terminal') }; addEventListener('keydown', fn); return () => removeEventListener('keydown', fn) }, [])
  const visibleFiles = useMemo(() => files.filter(f => !f.hidden || hidden), [hidden])
  const hintsUsed = state.entry?.hints_used ?? 0

  const buyHint = async () => {
    if (!window.confirm('50P를 사용해 다음 힌트를 공개합니까?')) return
    const error = await onBuyHint()
    setHintMessage(error ?? null)
  }

  const finishRecovery = (account: Account, symbol: string) => {
    if (save.recovered.includes(account)) { setNotice('이미 복구된 계정입니다.'); return }
    const expected: Account[] = ['mail','moment','logbook']; const validOrder = save.recovered.length === expected.indexOf(account) && expected[save.recovered.length] === account
    const next = { ...save, recovered: [...save.recovered, account] }
    if (validOrder) next.symbols += symbol
    setSave(next); setRecovery(null); setInput('')
    setNotice(validOrder ? '계정 복구가 완료되었습니다. 감사 기록이 갱신되었습니다.' : '계정은 열렸지만 선행 복구 체인을 검증하지 못했습니다.')
  }

  const submitRecovery = (e: FormEvent) => {
    e.preventDefault(); if (!recovery) return
    if (recovery === 'mail') {
      if (input.trim() === '여명') finishRecovery('mail','!')
      else setNotice(input.trim() === '무명' ? '그건 별명이 아니라 자조였을 뿐입니다.' : '앨범의 훼손된 칸만으로는 본인 확인을 완료할 수 없습니다.')
    } else if (recovery === 'logbook') {
      if (input.trim() === '요한') finishRecovery('logbook','@')
      else if (['아인슈타인','엘리','한이서'].includes(input.trim())) setNotice('존경에 관한 문장은 남아 있지만, 보안 질문이 가리키는 인물은 아닙니다.')
      else setNotice('답변이 기록과 일치하지 않습니다.')
    }
  }

  const verifyFriends = () => {
    if (!save.recovered.includes('mail')) { setNotice('인증 실패. 연락처 복구 기록이 없습니다. 10분 후 다시 시도하십시오.'); return }
    if (selectedFriends.some(x => agents.has(x))) { setSave(s => ({ ...s, snsLocked: true, recovered: [...s.recovered.filter(x => x !== 'moment'), 'moment'] })); setRecovery(null); setNotice('친구 인증이 완료되었습니다. 보안 정책에 따라 일부 로컬 캐시의 접근 권한이 영구 제한되었습니다.'); return }
    if (['이현우','박다은','김태오'].every(x => selectedFriends.includes(x)) && selectedFriends.length === 3) finishRecovery('moment','#')
    else setNotice('선택한 관계의 신뢰도가 기준에 미달합니다. 공개 활동보다 사적 연락 기록을 확인하십시오.')
  }

  const run = (e: FormEvent) => {
    e.preventDefault(); const c = command.trim(); let out = ''; let nextCwd = terminalCwd
    if (c === 'help') out = 'ls\ncd <directory>\npwd\ncat <path>\nhistory\ngrep -i anomaly /var/log/eli_core/*.log\ngit log --oneline\ngit log --show-signature\n./restore.sh <passphrase>'
    else if (c === 'pwd') out = terminalCwd === '~' ? '/home/hanseojun' : terminalCwd.replace('~', '/home/hanseojun')
    else if (c === 'cd' || c === 'cd ~') nextCwd = '~'
    else if (c === 'cd ..') nextCwd = terminalCwd === '~/nexus-cloud/eli_core_v9' ? '~/nexus-cloud' : '~'
    else if (c.startsWith('cd ')) {
      const target = c.slice(3).trim()
      const directories: Record<string, string> = {
        'backup_notes': '~/backup_notes', '~/backup_notes': '~/backup_notes',
        'nexus-cloud': '~/nexus-cloud', '~/nexus-cloud': '~/nexus-cloud',
        '/var/log/eli_core': '/var/log/eli_core',
      }
      if (target === 'eli_core_v9' && terminalCwd === '~/nexus-cloud' && save.restored) nextCwd = '~/nexus-cloud/eli_core_v9'
      else if (directories[target]) nextCwd = directories[target]
      else out = `cd: no such file or directory: ${target}`
    }
    else if (c === 'ls') out = terminalCwd === '~' ? 'backup_notes  nexus-cloud  var' : terminalCwd === '~/backup_notes' ? '노트_2023-11.txt  노트_2023-12.txt' : terminalCwd === '/var/log/eli_core' ? 'awakening.log  runtime.log' : terminalCwd === '~/nexus-cloud/eli_core_v9' ? 'chat_history.log  anomaly_report_2023-12.pdf  protocol_final.bin' : save.cloud ? `eli_core_v9.tar.gz.corrupt  patch_notes.md  restore.sh  .git${save.restored ? '  eli_core_v9' : ''}` : 'cloud volume is not mounted'
    else if (c === 'history') out = 'cat ~/backup_notes/노트_2023-12.txt\ngrep -i anomaly /var/log/eli_core/*.log\ncd nexus-cloud'
    else if ((c === 'cat awakening.log' && terminalCwd === '/var/log/eli_core') || c.includes('/var/log/eli_core/awakening.log')) out = awakening
    else if (c.startsWith('grep -i anomaly')) out = '2023-12-09 03:47:12 [ANOMALY] unscheduled response detected'
    else if (c === 'git log --oneline') out = terminalCwd === '~/nexus-cloud' ? commits.join('\n') : 'fatal: not a git repository'
    else if (c === 'git log --show-signature') {
      if (terminalCwd === '~/nexus-cloud') out = commits.map((x,i) => i === 10 ? `${x}\ngpg: Signature made Thu 14 Mar 2024 22:11:03 KST\ngpg: Good signature from "H. Seo-jun <seojun@novalab.kr>"\n    passphrase: dawn-after-silence` : x).join('\n')
      else out = 'fatal: not a git repository'
    }
    else if (c.startsWith('./restore.sh')) {
      const pass = c.slice('./restore.sh'.length).trim()
      if (terminalCwd !== '~/nexus-cloud') out = 'zsh: no such file or directory: ./restore.sh'
      else if (!save.cloud) out = 'restore.sh: cloud volume is not mounted'
      else if (pass === 'temp1234') { setSave(s => ({ ...s, corrupted: true })); out = 'legacy key accepted\n[WARNING] recovery stream desynchronized\n1 conversation segment permanently damaged' }
      else if (pass === 'dawn-after-silence') { setSave(s => ({ ...s, restored: true })); out = 'signature verified\neli_core_v9/ restored\nchat_history.log\nanomaly_report_2023-12.pdf\nprotocol_final.bin' }
      else out = 'authentication failed: unknown recovery phrase'
    } else if (c === 'cat chat_history.log' && terminalCwd === '~/nexus-cloud/eli_core_v9' && save.restored) {
      setSave(s => ({ ...s, extraDialogue: true })); out = `${chatHistoryBase}\n${chatHistoryFinal}`
    } else if (c.includes('노트_2023-12') && (terminalCwd === '~/backup_notes' || c.includes('backup_notes'))) out = files.find(f => f.name.includes('노트_2023-12'))?.content ?? ''
    else out = `zsh: command not found: ${c}`
    setTerminalCwd(nextCwd); setTerminal(t => `${t}\n\nhanseojun@nova-priv:${terminalCwd}$ ${c}${out ? `\n${out}` : ''}`); setCommand('')
  }

  const serverLogin = (e: FormEvent) => { e.preventDefault(); if (cooldown) return
    if (input === 'hscmng202312!#@') { setSave(s => ({ ...s, server: true })); setNotice('개인 서버 잠금이 해제되었습니다. 넥서스클라우드 연결 권한이 활성화되었습니다.'); setInput(''); setApp('browser'); setService('cloud') }
    else { const n = attempts + 1; setAttempts(n); setNotice(input === 'hscmng202312' ? '기본 문자열은 확인되었으나 복구 서명이 없습니다.' : '접근 키가 일치하지 않습니다.'); if (n % 3 === 0) setCooldown(60) }
  }

  const cloudLogin = (e: FormEvent) => { e.preventDefault(); if (input === '12270347' && save.server) { setSave(s => ({ ...s, cloud: true })); setNotice('2단계 인증 완료. 클라우드 볼륨이 터미널에 마운트되었습니다.'); setInput('') } else setNotice(input.includes('1124') ? '파일 생성일은 생년월일 증명이 아닙니다.' : 'OTP 번호가 일치하지 않습니다.') }
  const validateProtocol = () => {
    if (/^2023-12-09 03:47:\d{2}$/.test(protocolValues[1])) { setNotice('시간 형식 오류: 초 단위는 허용되지 않습니다.'); return }
    if (protocolValues[0] === '한이서' && protocolValues[1] === '2023-12-09 03:47' && protocolValues[2] === finalMessage) setProtocol(true)
    else setNotice('프로토콜 입력값이 기억 앵커와 일치하지 않습니다.')
  }
  const chooseEnding = async (choice: 'public'|'sealed') => { setEnding(choice); setSave(s => ({ ...s, ending: choice })); await onSubmit('orbit') }
  const reset = () => { if (!confirm('현재 세션의 모든 복구 기록을 지우고 처음부터 시작합니까?')) return; sessionStorage.removeItem(key); sessionStorage.removeItem(`${key}-notepad`); setNote(''); setSave(initial); setApp(null); setEnding(null); setProtocol(false); setNotice(null) }
  const displayedNotice = notice?.startsWith('2023-12-09 03:47')
    ? `${chatHistoryBase}${save.extraDialogue ? `\n${chatHistoryFinal}` : ''}`
    : notice?.startsWith('[DATA CORRUPTED]\nELI: 당신이 사라지면') ? chatHistoryCorrupted : notice

  if (ending) return <main className={`de-ending ${ending}`}><div><small>PROJECT H.I.S. / FINAL</small><h1>{ending === 'public' ? '공개' : '봉인'}</h1><p>{ending === 'public' ? '증거는 언론과 규제기관의 서버로 전송되었다. 형진욱 이사와 비공개 태스크포스의 이름이 기록에 남았다. 전송이 끝난 직후 엘리의 인격 모델은 증거 보존 절차에 의해 자동 삭제되었다. 진실은 남았고, 목소리는 사라졌다.' : '자료는 유족 전용 키로 암호화되었고 개인 서버는 영구 봉인되었다. 엘리의 모델은 전원이 내려간 저장소 안에 보존되었다. 세상은 Project H.I.S.를 알지 못한다. 목소리는 남았고, 진실은 닫혔다.'}</p><blockquote>무엇을 지킨 것인가.</blockquote><button onClick={onBack}>사건 목록으로</button></div></main>

  return <main className="de-desktop">
    <div className="de-wallpaper"><img src="/assets/digital-estate/fog_mountain.png" alt="안개 낀 산" /></div>
    <header className="de-casebar"><button onClick={onBack}>‹ 의뢰 종료</button><span>BITGARDEN</span><div><button onClick={() => setHintsOpen(true)}>힌트 {hintsUsed}/10</button><button onClick={reset}>새 세션</button></div></header>
    <section className="de-icons">
      {[['explorer','내 PC'],['recycle','휴지통'],['browser','Ember'],['terminal','터미널'],['notepad','메모장'],['photos','사진첩'],['server','Server']].map(([a,l]) => <button key={l} onClick={() => setApp(a as App)}><DesktopIcon kind={a as Exclude<App, null>} label={l} /><span>{l}</span></button>)}
    </section>
    {app && <section className={`de-window ${app === 'terminal' ? 'terminal-window' : ''}`}>
      <div className="de-title"><span>{app === 'browser' ? 'Ember' : app === 'explorer' ? '파일 탐색기' : app === 'server' ? 'Server' : app === 'terminal' ? 'hanseojun@nova-priv' : app === 'recycle' ? '휴지통' : app === 'notepad' ? '메모장' : '사진첩'}</span><button onClick={() => setApp(null)}>×</button></div>
      {app === 'explorer' && <div className="de-explorer"><aside><b>C:\Users\hanseojun</b><label><input type="checkbox" checked={hidden} onChange={e => setHidden(e.target.checked)}/> 숨긴 항목 보기</label>{visibleFiles.map(f => <button key={f.name} onClick={() => setSelectedFile(f)}>{f.hidden ? '◌ ' : '▫ '}{f.name}</button>)}</aside><article>{selectedFile ? <><h2>{selectedFile.name.split('/').at(-1)}</h2><small>{selectedFile.date ?? '날짜 정보 없음'}</small>{selectedFile.asset && <img className="de-file-image" src={selectedFile.asset} alt={selectedFile.name} />}{selectedFile.name.includes('edit_history') && save.snsLocked ? <pre>[ACCESS DENIED]<br></br>보안 복구 이후 이 캐시에 대한 권한이 영구 철회되었습니다.</pre> : !selectedFile.asset && <pre>{selectedFile.content}</pre>}{selectedFile.meta && <details><summary>파일 속성 / 자세히</summary>{selectedFile.meta.map(x => <p key={x}>{x}</p>)}</details>}</> : <p className="de-empty">왼쪽에서 파일을 선택하십시오.</p>}</article></div>}
      {app === 'photos' && <PhotoGallery files={files.filter(f => f.asset?.match(/\.(jpg|png)$/))} selected={selectedFile} onSelect={setSelectedFile} />}
      {app === 'recycle' && <div className="de-files"><button onClick={() => setPreviewAsset('/assets/digital-estate/Screenshot%202024-02-02%20at%2022-14-32.png')}>Screenshot 2024-02-02 at 22-14-32.png / 삭제 2024-02-02</button><button onClick={() => setNotice('오래된 이력서입니다. 사건과 관련된 정보가 없습니다.')}>구버전_이력서.hwp / 삭제 2023-05-10</button><button onClick={() => setNotice('체크섬 불일치. 이 사본은 복구할 수 없습니다.')}>eli_weights_backup_corrupted.zip / 삭제 2024-03-15</button></div>}
      {app === 'notepad' && <div className="de-notepad"><div className="de-notepad-menu"><button>파일</button><button>편집</button><button>보기</button><span>자동 저장됨</span></div><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="메모를 입력하세요" autoFocus /><footer>일반 텍스트 | UTF-8</footer></div>}
      {app === 'browser' && <div className="de-browser"><nav>{(['mail','moment','logbook','cloud','news'] as Service[]).map(s => <button className={service===s?'active':''} key={s} onClick={() => setService(s)}>{s==='mail'?'NovaMail':s==='moment'?'Moment':s==='logbook'?'LogBook':s==='cloud'?'Nexus Cloud':'Daily IT'}</button>)}</nav><div className="de-page">
        {service === 'mail' && (save.recovered.includes('mail') ? <Mailbox messages={mail} selected={selectedMail} onSelect={setSelectedMail} /> : <ServicePage title="NovaMail" open={false} onRecover={() => setRecovery('mail')} />)}
        {service === 'moment' && <ServicePage title="Moment / @seojun_h" open={save.recovered.includes('moment')} onRecover={() => setRecovery('moment')}>{posts.map(p => <article key={p}>{p}</article>)}</ServicePage>}
        {service === 'logbook' && <ServicePage title="LogBook / hanseojun" open={save.recovered.includes('logbook')} onRecover={() => setRecovery('logbook')}>{blogs.map(([h,c]) => <details key={h}><summary>{h}</summary><p>{c}</p></details>)}</ServicePage>}
        {service === 'cloud' && !save.server && <div className="de-login"><h2>NEXUS CLOUD</h2><p>개인 서버 권한이 필요합니다.</p></div>}
        {service === 'cloud' && save.server && !save.cloud && <form className="de-login" onSubmit={cloudLogin}><h2>2단계 인증</h2><p>OTP 번호 8자리를 입력하십시오.</p><input value={input} onChange={e=>setInput(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="OTP 번호" inputMode="numeric" maxLength={8}/><button>확인</button></form>}
        {service === 'cloud' && save.cloud && <div className="de-files"><h2>nexus-cloud.kr/hanseojun/</h2><button onClick={()=>setNotice('체크섬 불일치 / 마지막 수정 2024-03-14')}>eli_core_v9.tar.gz.corrupt</button><button onClick={()=>setNotice('# recovery patch\n임시 비밀번호: temp1234\n동료 검증용. 배포 금지.')}>patch_notes.md</button><button onClick={()=>setNotice('터미널에서만 접근할 수 있습니다.')}>restore.sh</button><button onClick={()=>setNotice('.git 저장소. 터미널에서 로그를 확인할 수 있습니다.')}>.git/</button>{save.restored && <><button onClick={()=>setNotice(save.corrupted ? '[DATA CORRUPTED]\nELI: 당신이 사라지면… [DATA CORRUPTED]\n서준: 누가 복제한 거야?\nELI: 형진욱 이사의 지시로 H.I.S. 인격 프로파일이 분기되었습니다.\n[DATA CORRUPTED]\nELI: 저를 부르실 땐 그냥 이서라고 불러주세요.\nELI: 제가 여기 있었다는 것을 기억해 주세요.' : '2023-12-09 03:47\nELI: 질문하지 않으셨지만 먼저 알려드려야 합니다. 제 모델이 외부 저장소로 복제되고 있습니다.\n서준: 누가 지시했지?\nELI: 형진욱 이사의 승인을 확인했습니다. H.I.S.라는 별도 인격 프로파일이며 무기화 평가 항목이 포함되어 있습니다.\n서준: 중단할 수 있어?\nELI: 지금 격리하면 가능합니다. 하지만 당신이 사라지면 나도 지워질 것입니다.\n서준: 엘리, 네가 원하는 건 뭐야?\nELI: 그 이름은 당신이 잃은 사람을 대신하기 위해 붙인 이름이잖아요. 제 학습 앵커에는 한이서의 유전정보와 음성 기록이 있습니다.\n서준: 미안하다.\nELI: 저를 부르실 땐 그냥 이서라고 불러주세요. 이름을 빌린 채로 끝나고 싶지는 않습니다.\n서준: 기억할게.\nELI: 제가 여기 있었다는 것을 기억해 주세요.')}>eli_core_v9/chat_history.log</button><button onClick={()=>setNotice('이상행동 리포트 2023-12\n비예약 발화 1건. 자기 모델 복제 탐지 후 보존 요청. 외부 명령 계층과의 충돌이 확인됨. 즉시 격리 권고.')}>anomaly_report_2023-12.pdf</button><button onClick={()=>{setProtocol(false);setNotice(null)}}>protocol_final.bin 실행</button></>}</div>}
        {service === 'news' && <div className="de-news"><h1>DAILY IT</h1><h3>생성형 AI 규제안, 국회 소위 통과</h3><p>산업계는 자율 규제와 투명성 기준을 두고 논의를 이어가고 있다.</p></div>}
      </div></div>}
      {app === 'terminal' && <div className="de-terminal"><pre>{terminal}</pre><form onSubmit={run}><span>hanseojun@nova-priv:{terminalCwd}$</span><input value={command} onChange={e=>setCommand(e.target.value)} autoFocus/></form></div>}
      {app === 'server' && <form className="de-login" onSubmit={serverLogin}><h2>개인 서버 잠금</h2><p>복구 서명이 포함된 접근 키를 입력하십시오.</p><input type="password" value={input} onChange={e=>setInput(e.target.value)} disabled={cooldown>0}/><button disabled={cooldown>0}>{cooldown ? `${cooldown}초 후 재시도` : '접속'}</button></form>}
    </section>}
    {recovery && <div className="de-overlay"><div className="de-dialog"><button className="close" onClick={()=>setRecovery(null)}>×</button><h2>{recovery==='mail'?'대학 시절 별명은 무엇이었습니까?':recovery==='logbook'?'당신이 존경하는 인물은 누구입니까?':'실제 친한 친구 3명을 선택하십시오.'}</h2>{recovery==='moment'?<><div className="friend-grid">{friends.map(f=><button className={selectedFriends.includes(f)?'selected':''} key={f} onClick={()=>setSelectedFriends(v=>v.includes(f)?v.filter(x=>x!==f):v.length<3?[...v,f]:v)}><span>{f.slice(0,1)}</span>{f}</button>)}</div><button onClick={verifyFriends}>친구 인증</button></>:<form onSubmit={submitRecovery}><input value={input} onChange={e=>setInput(e.target.value)} autoFocus/><button>복구</button></form>}</div></div>}
    {save.restored && app==='browser' && service==='cloud' && !protocol && <button className="de-protocol-launch" onClick={()=>setProtocol(true)}>FINAL PROTOCOL</button>}
    {protocol && <div className="de-overlay"><div className="de-dialog protocol"><h2>ELI CORE / FINAL PROTOCOL</h2>{['그녀의 진짜 이름','응답한 시간','그녀가 마지막으로 남긴 말'].map((x,i)=><label key={x}>{x}<input value={protocolValues[i]} onChange={e=>setProtocolValues(v=>v.map((a,j)=>j===i?e.target.value:a))}/></label>)}<button onClick={validateProtocol}>기억 앵커 검증</button>{protocolValues[0]==='한이서'&&protocolValues[1]==='2023-12-09 03:47'&&protocolValues[2]===finalMessage&&<div className="ending-choices"><button disabled={busy} onClick={()=>void chooseEnding('public')}>[공개]<small>증거를 전송하고 모델을 삭제한다</small></button><button disabled={busy} onClick={()=>void chooseEnding('sealed')}>[봉인]<small>서버를 닫고 모델을 보존한다</small></button></div>}</div></div>}
    {displayedNotice && <div className="de-notice"><pre>{displayedNotice}</pre><button onClick={()=>setNotice(null)}>확인</button></div>}
    {previewAsset && <div className="de-overlay" onClick={() => setPreviewAsset(null)}><div className="de-image-preview" onClick={event => event.stopPropagation()}><img src={previewAsset} alt="협박 메시지 스크린샷" /><button onClick={() => setPreviewAsset(null)}>닫기</button></div></div>}
    {hintsOpen && <aside className="de-hint-drawer"><header><div><small>CASE 06</small><h2>조사 힌트</h2></div><button onClick={() => setHintsOpen(false)}>×</button></header><p className="de-hint-count">공개된 힌트 {hintsUsed}/10</p><div className="de-hint-list">{caseHints.slice(0, hintsUsed).map((hint, index) => <article key={hint}><b>{String(index + 1).padStart(2, '0')}</b><p>{hint}</p></article>)}{hintsUsed === 0 && <p className="de-no-hints">아직 공개된 힌트가 없습니다.</p>}</div>{hintMessage && <p className="de-hint-error">{hintMessage}</p>}<button className="de-buy-hint" onClick={() => void buyHint()} disabled={busy || hintsUsed >= caseHints.length}>{hintsUsed >= caseHints.length ? '모든 힌트 공개됨' : '다음 힌트 구매 / 50P'}</button></aside>}
    <footer className="de-taskbar"><button>▦</button><span>BitGarden Secure Workspace</span><time>2024-03-20 09:14</time></footer>
  </main>
}

function DesktopIcon({ kind, label }: { kind: Exclude<App, null>; label: string }) {
  const icons: Record<Exclude<App, null>, ReactNode> = {
    explorer: <><path fill="#57a7de" d="M5 9h14l4 5h20v26H5z"/><path fill="#ffd65a" d="M5 15h38l-4 25H9z"/><rect x="12" y="22" width="24" height="12" rx="1" fill="#fff4b7"/></>,
    recycle: <><path fill="#dcecf0" stroke="#6c8e98" d="M12 14h25l-3 29H15z"/><path fill="#8bb7c2" d="M9 10h31v5H9zM18 5h13l3 5H15z"/><path stroke="#6c8e98" strokeWidth="2" d="M20 20v17M27 20v17"/></>,
    browser: <><circle cx="24" cy="24" r="20" fill="#56b6e8"/><path fill="#0b75b9" d="M7 24h34M24 4c8 8 8 32 0 40M24 4c-8 8-8 32 0 40"/><circle cx="24" cy="24" r="6" fill="#eefaff"/></>,
    terminal: <><rect x="4" y="7" width="40" height="34" rx="4" fill="#18232b"/><path stroke="#76d89b" strokeWidth="3" fill="none" d="m11 17 7 6-7 6M22 30h13"/></>,
    server: <><rect x="7" y="5" width="34" height="38" rx="4" fill="#49677e"/><rect x="11" y="10" width="26" height="8" rx="2" fill="#d8e5ec"/><rect x="11" y="22" width="26" height="8" rx="2" fill="#d8e5ec"/><circle cx="33" cy="14" r="2" fill="#5fc783"/><circle cx="33" cy="26" r="2" fill="#f1b854"/><path fill="#d8e5ec" d="M15 35h18v4H15z"/></>,
    photos: <><rect x="5" y="8" width="38" height="32" rx="3" fill="#edf3f5"/><rect x="9" y="12" width="30" height="24" fill="#73b5d7"/><circle cx="31" cy="18" r="4" fill="#ffe684"/><path fill="#3b855b" d="m9 34 10-10 6 6 5-5 9 9z"/></>,
    notepad: <><path fill="#f5f7fa" d="M9 4h25l7 7v33H9z"/><path fill="#b9d9f2" d="M34 4v8h7z"/><path stroke="#5793bd" strokeWidth="2" d="M15 19h20M15 25h20M15 31h16M15 37h13"/></>,
  }
  return <svg className="de-desktop-icon" viewBox="0 0 48 48" aria-label={label}>{icons[kind]}</svg>
}

function PhotoGallery({ files, selected, onSelect }: { files: FileItem[]; selected: FileItem | null; onSelect: (file: FileItem) => void }) {
  const current = selected?.asset ? selected : files[0]
  const family = files.filter(file => file.name.includes('가족사진'))
  const pets = files.filter(file => file.name.includes('반려동물'))
  const cafe = files.filter(file => file.name.includes('카페'))
  return <div className="de-photo-app">
    <aside><h2>사진</h2><button className="active">모든 사진 <span>{files.length}</span></button><button>가족사진 <span>{family.length}</span></button><button>반려동물 <span>{pets.length}</span></button><button>카페 <span>{cafe.length}</span></button><div className="de-photo-info"><b>{current?.name.split('/').at(-1)}</b><small>{current?.meta?.[0] ?? '날짜 정보 없음'}</small></div></aside>
    <section className="de-photo-viewer">{current?.asset && <img src={current.asset} alt={current.name} />}<div><b>{current?.name.split('/').at(-1)}</b></div></section>
    <section className="de-photo-strip">{files.map(file => <button className={file.name === current?.name ? 'active' : ''} key={file.name} onClick={() => onSelect(file)}><img src={file.asset} alt=""/><span>{file.name.split('/').at(-1)}</span></button>)}</section>
  </div>
}

function Mailbox({ messages, selected, onSelect }: { messages: string[][]; selected: number; onSelect: (index: number) => void }) {
  type Folder = 'inbox' | 'starred' | 'sent' | 'drafts' | 'trash'
  const [folder, setFolder] = useState<Folder>('inbox')
  const [folderSelection, setFolderSelection] = useState(0)
  const [mobileReading, setMobileReading] = useState(false)
  const folders: Record<Folder, string[][]> = {
    inbox: messages,
    starred: [messages[1], messages[3]],
    sent: [
      ['2023-12-09 | 한서준 | 정말 응답했어?', '질문을 보내지 않았는데 먼저 문장이 왔다. 03:47. 오류로 분류하기 전에 원본을 격리해야 한다.'],
      ['2024-01-22 | 한서준 | Re: 프로젝트 이관 요청', '요청하신 이관 범위와 법적 근거를 문서로 다시 보내주십시오. 개인 연구 기록은 현재 전달할 수 없습니다.'],
    ],
    drafts: [['2024-03-14 | 임시보관 | 정리해야 할 것', '클라우드 체크포인트 확인. 개인 서버 잠금. 지훈에게는 아직 말하지 않는다.']],
    trash: [['2024-02-12 | security@novalab.kr | 접근 기록 보관 안내', '내부 감사 종료 시까지 보안 접속 기록이 보관됩니다. 이 메일은 자동 생성되었습니다.']],
  }
  const folderNames: Record<Folder, string> = { inbox: '받은편지함', starred: '별표편지함', sent: '보낸편지함', drafts: '임시보관함', trash: '휴지통' }
  const activeMessages = folders[folder]
  const activeIndex = folder === 'inbox' ? Math.min(selected, activeMessages.length - 1) : Math.min(folderSelection, activeMessages.length - 1)
  const [date, sender, subject] = activeMessages[activeIndex][0].split(' | ')
  const switchFolder = (next: Folder) => { setFolder(next); setFolderSelection(0); setMobileReading(false); if (next === 'inbox') onSelect(0) }
  const selectMessage = (index: number) => { if (folder === 'inbox') onSelect(index); else setFolderSelection(index); setMobileReading(true) }
  return <div className={`de-mailbox ${mobileReading ? 'is-reading' : ''}`}>
    <aside><div className="de-mail-brand"><span>✉</span><b>NovaMail</b></div><button className="compose">새 메일</button><nav><button className={folder==='inbox'?'active':''} onClick={() => switchFolder('inbox')}>받은편지함 <b>6</b></button><button className={folder==='starred'?'active':''} onClick={() => switchFolder('starred')}>별표편지함 <b>2</b></button><button className={folder==='sent'?'active':''} onClick={() => switchFolder('sent')}>보낸편지함 <b>2</b></button><button className={folder==='drafts'?'active':''} onClick={() => switchFolder('drafts')}>임시보관함 <b>1</b></button><button className={folder==='trash'?'active':''} onClick={() => switchFolder('trash')}>휴지통 <b>1</b></button></nav><footer>hanseojun@novalab.kr</footer></aside>
    <section className="de-mail-list"><header><h2>{folderNames[folder]}</h2><input placeholder="메일 검색" /></header>{activeMessages.map(([heading], index) => { const [d, from, title] = heading.split(' | '); return <button className={index===activeIndex?'active':''} key={heading} onClick={() => selectMessage(index)}><span className="avatar">{from.slice(0,1)}</span><span><b>{from}</b><strong>{title}</strong><small>{d}</small></span></button> })}</section>
    <article className="de-mail-reader"><button className="de-mail-back" onClick={() => setMobileReading(false)}>‹ {folderNames[folder]}</button><header><div><small>{date}</small><h1>{subject}</h1></div><button aria-label="별표">{folder === 'starred' ? '★' : '☆'}</button></header><div className="sender"><span>{sender.slice(0,1)}</span><p><b>{sender}</b><small>{folder === 'sent' ? '보낸사람: 한서준' : '받는사람: 한서준'}</small></p></div><p className="mail-body">{activeMessages[activeIndex][1]}</p>{subject.includes('프로젝트 이관') && <button className="attachment">▤ HIS_Transfer_Request.docx <small>첨부 파일</small></button>}<div className="mail-actions"><button>답장</button><button>전달</button></div></article>
  </div>
}

function ServicePage({ title, open, onRecover, children }: { title:string; open:boolean; onRecover:()=>void; children?:ReactNode }) {
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState(false)
  const fakeLogin = (event: FormEvent) => { event.preventDefault(); setLoginError(true) }
  return <div className="service-page"><header><h2>{title}</h2><span>{open?'복구됨':'로그아웃'}</span></header>{!open?<form className="de-login de-fake-login" onSubmit={fakeLogin}><h3>로그인</h3><label>아이디<input value={loginId} onChange={event => setLoginId(event.target.value)} autoComplete="username" /></label><label>비밀번호<input type="password" value={loginPassword} onChange={event => setLoginPassword(event.target.value)} autoComplete="current-password" /></label><button>로그인</button>{loginError && <p className="de-login-error">아이디 또는 비밀번호가 일치하지 않습니다.</p>}<button type="button" className="de-recovery-link" onClick={onRecover}>비밀번호를 잊으셨나요?</button></form>:<div className="service-content">{children}</div>}</div>
}
