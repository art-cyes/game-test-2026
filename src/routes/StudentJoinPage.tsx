import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PixelButton } from '@/components/PixelButton'
import { PixelPanel } from '@/components/PixelPanel'
import { AnimatedHero } from '@/components/AnimatedHero'
import { useStudentBattle } from '@/hooks/useStudentBattle'
import { useStudentSession, type StudentIdentity } from '@/hooks/useStudentSession'
import { unlockAudio } from '@/lib/audio'

import { normalizeRoomCode } from '@/lib/game/roomCode'
import { normalizeSeatNo } from '@/lib/game/seatNo'
import { BOSS_DIFFICULTY_LABEL, ROLE_LABEL, type Role } from '@/types'
import { ResultScreen } from './ResultScreen'
import { StudentBattleScreen } from './StudentBattleScreen'

const ROLES: { role: Role; emoji: string; name: string; passive: string }[] = [
  { role: 'warrior', emoji: '⚔️', name: '戰士', passive: '攻擊力最高（傷害 +10%）' },
  { role: 'priest', emoji: '🛡️', name: '牧師', passive: '防禦能量累積快（+30%）' },
  { role: 'mage', emoji: '🔮', name: '法師', passive: '大招能量累積快（+30%）' },
]

/* ------------------------------------------------------------------ */
/* 沒有房間代碼時：先輸入代碼                                          */
/* ------------------------------------------------------------------ */

function EnterRoomCode() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')

  return (
    <div className="game-surface mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <h1 className="font-pixel text-center text-base text-gold sm:text-lg">加入勇者團</h1>
      <PixelPanel title="輸入房間代碼">
        <input
          value={code}
          onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
          placeholder="例如 AB3K"
          className="w-full border-[3px] border-black bg-night-800 px-3 py-4 text-center font-pixel text-xl tracking-[0.3em] text-ink outline-none placeholder:text-muted/40 focus:border-gold"
        />
        <PixelButton
          variant="success"
          size="lg"
          className="mt-4 w-full"
          disabled={code.length < 3}
          onClick={() => navigate(`/join/${code}`)}
        >
          下一步
        </PixelButton>
      </PixelPanel>
      <p className="text-center text-xs text-muted">通常掃老師的 QR Code 就會直接進來這裡。</p>
      <Link to="/" className="text-center font-pixel text-[10px] text-muted hover:text-ink">
        ← 回上一頁
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

export function StudentJoinPage() {
  const { roomCode: roomCodeParam } = useParams<{ roomCode?: string }>()
  const roomCode = roomCodeParam ? normalizeRoomCode(roomCodeParam) : ''

  const [step, setStep] = useState<'form' | 'role'>('form')
  const [seatNo, setSeatNo] = useState('')
  const [name, setName] = useState('')
  const [identity, setIdentity] = useState<StudentIdentity | null>(null)

  const session = useStudentSession({ roomCode: roomCode || null, identity })
  const battleHook = useStudentBattle({
    adapter: session.adapter,
    status: session.status,
    identity,
  })

  if (!roomCode) return <EnterRoomCode />

  const { joinState, reason, lobby, phase, status } = session

  const reset = () => {
    setIdentity(null)
    setStep('form')
  }

  /* ---------------- 已送出加入後 ---------------- */
  if (identity) {
    const myRole = ROLES.find((r) => r.role === identity.role)

    /* 戰鬥中：答題畫面 */
    if (joinState === 'accepted' && phase === 'battle') {
      return (
        <StudentBattleScreen
          name={`${identity.seatNo} ${identity.name}`}
          role={identity.role}
          bossDifficulty={lobby?.bossDifficulty ?? 'normal'}
          battle={battleHook.battle}
          question={battleHook.question}
          answered={battleHook.answered}
          feedback={battleHook.feedback}
          shakeToken={battleHook.shakeToken}
          skillNotice={battleHook.skillNotice}
          onAnswer={battleHook.answer}
        />
      )
    }

    /* 結算 */
    if (joinState === 'accepted' && phase === 'result') {
      if (battleHook.outcome) {
        return (
          <ResultScreen
            className={lobby?.className ?? '勇者團'}
            bossDifficulty={lobby?.bossDifficulty ?? 'normal'}
            outcome={battleHook.outcome}
            battle={battleHook.battle}
            highlightSeatNo={identity.seatNo}
            compact
          />
        )
      }
      const won = battleHook.battle?.status === 'win'
      return (
        <div className="game-surface mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 px-4 py-8 text-center">
          <p className={`font-pixel text-2xl ${won ? 'text-gold' : 'text-hp'}`}>
            {won ? 'VICTORY!' : 'DEFEAT…'}
          </p>
          <p className="text-4xl">{won ? '🏆' : '💀'}</p>
          <p className="text-sm leading-relaxed text-muted">
            {battleHook.notice || (won ? '勇者們成功打倒了魔王！' : '這次沒能打倒魔王，下次再挑戰！')}
          </p>
          <p className="text-xs text-muted">
            魔王剩餘 HP：{battleHook.battle?.bossHp ?? '?'}　·　團隊剩餘 HP：
            {battleHook.battle?.teamHp ?? '?'}　·　剩餘時間：
            {battleHook.battle?.remainingSec ?? '?'} 秒
          </p>
          <PixelPanel title="團隊戰績">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">全隊答對</dt>
                <dd className="font-pixel text-guard">{battleHook.battle?.totalCorrect ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">全隊答錯</dt>
                <dd className="font-pixel text-hp">{battleHook.battle?.totalWrong ?? 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">你的角色</dt>
                <dd className="text-ink">{ROLE_LABEL[identity.role]}</dd>
              </div>
            </dl>
          </PixelPanel>
          <p className="text-xs text-muted">完整的個人排行與答題報表將於 M5 公布。</p>
        </div>
      )
    }

    if (joinState === 'accepted') {
      return (
        <div className="game-surface mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 px-4 py-8">
          <div className="text-center">
            <p className="font-pixel text-lg text-gold">加入成功！</p>
            <p className="mt-2 text-sm text-muted">等待老師開始遊戲…</p>
          </div>

          <PixelPanel title="你的角色">
            <div className="flex items-center gap-4">
              <AnimatedHero role={identity.role} size={104} />
              <div>
                <p className="font-pixel text-base text-ink">
                  座號 {identity.seatNo}　{identity.name}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {ROLE_LABEL[identity.role]}｜{myRole?.passive}
                </p>
              </div>
            </div>
          </PixelPanel>

          <PixelPanel title="戰場資訊">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">班級</dt>
                <dd className="text-ink">{lobby?.className ?? '…'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">大魔王</dt>
                <dd className="text-ink">
                  {lobby?.bossName ?? '…'}
                  {lobby && (
                    <span className="ml-2 text-xs text-muted">
                      {BOSS_DIFFICULTY_LABEL[lobby.bossDifficulty]}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">集結中</dt>
                <dd className="font-pixel text-xs text-gold">
                  {lobby ? `${lobby.playerCount} / ${lobby.maxPlayers}` : '…'}
                </dd>
              </div>
            </dl>
          </PixelPanel>

          <p className="text-center text-xs text-muted">
            {status === 'connected' ? '🟢 已連線' : '⚠ 連線中斷，正在重試…'}
            <br />
            請保持這個畫面開啟，不要切到別的 APP。
          </p>
        </div>
      )
    }

    if (joinState === 'rejected' || joinState === 'kicked' || joinState === 'timeout') {
      const title =
        joinState === 'kicked'
          ? '你已被移出遊戲'
          : joinState === 'timeout'
            ? '找不到遊戲主機'
            : '無法加入'
      const message =
        joinState === 'timeout'
          ? '老師的遊戲頁面可能還沒開啟，或網路不通。請確認老師已經建立房間，再試一次。'
          : reason

      return (
        <div className="game-surface mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 px-4 py-8">
          <p className="font-pixel text-center text-base text-hp">{title}</p>
          <p className="border-[3px] border-black bg-night-700 px-4 py-4 text-center text-sm leading-relaxed text-ink">
            {message}
          </p>
          <PixelButton size="lg" onClick={reset}>
            重新輸入座號
          </PixelButton>
          {joinState === 'timeout' && (
            <PixelButton variant="secondary" onClick={session.retry}>
              再試一次
            </PixelButton>
          )}
        </div>
      )
    }

    // pending
    return (
      <div className="game-surface mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 px-4 py-8 text-center">
        <p className="font-pixel animate-pulse-soft text-sm text-gold">正在通知老師…</p>
        <p className="text-sm text-muted">
          座號 {identity.seatNo}　{identity.name}
        </p>
        {status !== 'connected' && <p className="text-xs text-hp">連線中…</p>}
      </div>
    )
  }

  /* ---------------- 表單 ---------------- */
  if (step === 'form') {
    const canNext = normalizeSeatNo(seatNo) !== '' && name.trim() !== ''
    return (
      <div className="game-surface mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-4 py-8">
        <header className="text-center">
          <h1 className="font-pixel text-base text-gold sm:text-lg">加入勇者團</h1>
          <p className="mt-3 text-xs text-muted">
            房間代碼：<span className="font-pixel ml-2 text-sm text-ink">{roomCode}</span>
          </p>
        </header>

        <PixelPanel title="你的資料">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">座號</span>
              <input
                type="text"
                inputMode="numeric"
                value={seatNo}
                onChange={(e) => setSeatNo(e.target.value)}
                placeholder="例如 7"
                className="w-full border-[3px] border-black bg-night-800 px-3 py-3.5 text-sm text-ink outline-none placeholder:text-muted/50 focus:border-gold"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">姓名</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如 王小明"
                className="w-full border-[3px] border-black bg-night-800 px-3 py-3.5 text-sm text-ink outline-none placeholder:text-muted/50 focus:border-gold"
              />
            </label>
          </div>
        </PixelPanel>

        <PixelButton
          variant="success"
          size="lg"
          className="w-full"
          disabled={!canNext}
          onClick={() => setStep('role')}
        >
          下一步：選擇角色
        </PixelButton>
      </div>
    )
  }

  /* ---------------- 選角色 ---------------- */
  return (
    <div className="game-surface mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <h1 className="font-pixel text-center text-base text-gold">選擇你的角色</h1>

      <div className="space-y-3">
        {ROLES.map((r) => (
          <button
            key={r.role}
            type="button"
            onClick={() => {
              unlockAudio()
              setIdentity({ seatNo: normalizeSeatNo(seatNo), name: name.trim(), role: r.role })
            }}
            className="flex w-full items-center gap-4 border-[3px] border-black bg-panel p-4 text-left transition hover:bg-panel-light active:translate-y-0.5"
          >
            <AnimatedHero role={r.role} size={92} title={r.name} />
            <span>
              <span className="block font-pixel text-base text-gold">{r.name}</span>
              <span className="mt-1.5 block text-sm text-muted">{r.passive}</span>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setStep('form')}
        className="font-pixel text-[10px] text-muted hover:text-ink"
      >
        ← 回上一步
      </button>
    </div>
  )
}
