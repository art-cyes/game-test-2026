import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PixelButton } from '@/components/PixelButton'
import { PixelPanel } from '@/components/PixelPanel'
import { BOSS_PRESETS, createDefaultSettings } from '@/config/gameDefaults'
import { saveGameSetup } from '@/lib/game/gameStore'
import { generateRoomCode } from '@/lib/game/roomCode'
import { BOSS_DIFFICULTY_LABEL, type BossDifficulty } from '@/types'

export function TeacherNewGamePage() {
  const navigate = useNavigate()

  const [className, setClassName] = useState('')
  const [bossDifficulty, setBossDifficulty] = useState<BossDifficulty>('normal')
  const [maxPlayers, setMaxPlayers] = useState(30)
  const [allowLateJoin, setAllowLateJoin] = useState(true)
  const [autoBalance, setAutoBalance] = useState(true)
  const [autoSkill, setAutoSkill] = useState(true)
  const [error, setError] = useState('')

  const create = () => {
    const name = className.trim()
    if (!name) {
      setError('請填寫班級名稱。')
      return
    }
    if (!Number.isFinite(maxPlayers) || maxPlayers < 1) {
      setError('遊玩人數至少要是 1。')
      return
    }

    const settings = createDefaultSettings(bossDifficulty, {
      className: name,
      maxPlayers: Math.min(Math.max(Math.round(maxPlayers), 1), 100),
      allowLateJoin,
      autoBalance,
      autoSkill,
    })
    const roomCode = generateRoomCode()
    saveGameSetup({ roomCode, settings, createdAt: Date.now() })
    navigate(`/teacher/room/${roomCode}`)
  }

  return (
    <div className="game-surface mx-auto flex min-h-full max-w-3xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-pixel text-sm text-gold">開新遊戲</h1>
        <Link to="/teacher" className="font-pixel text-[10px] text-muted hover:text-ink">
          ← 回老師端
        </Link>
      </header>

      <PixelPanel title="基本設定">
        <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">班級名稱</span>
            <input
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="例如 五年一班"
              className="w-full border-[3px] border-black bg-night-800 px-3 py-3 text-sm text-ink outline-none placeholder:text-muted/50 focus:border-gold"
            />
          </label>

          <div>
            <span className="mb-2 block text-xs text-muted">魔王難度（決定遊戲時間）</span>
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.values(BOSS_PRESETS).map((boss) => {
                const active = bossDifficulty === boss.difficulty
                return (
                  <button
                    key={boss.difficulty}
                    type="button"
                    onClick={() => setBossDifficulty(boss.difficulty)}
                    className={[
                      'border-[3px] border-black p-4 text-left transition',
                      active ? 'bg-gold text-night-900' : 'bg-night-700 text-ink hover:bg-night-600',
                    ].join(' ')}
                  >
                    <p className="font-pixel text-[11px]">
                      {BOSS_DIFFICULTY_LABEL[boss.difficulty]}
                    </p>
                    <p className="mt-2 text-sm">{boss.name}</p>
                    <p className={`mt-2 text-xs ${active ? 'text-night-800' : 'text-muted'}`}>
                      {boss.durationSec / 60} 分鐘
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">
                遊玩人數（學生用自己的座號加入）
              </span>
              <input
                type="number"
                min={1}
                max={100}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full border-[3px] border-black bg-night-800 px-3 py-3 font-pixel text-sm text-ink outline-none focus:border-gold"
              />
            </label>

            <label className="flex items-end gap-3 pb-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={allowLateJoin}
                onChange={(e) => setAllowLateJoin(e.target.checked)}
                className="size-5 accent-[#ffd23f]"
              />
              允許遊戲中途加入
            </label>
          </div>

          <label className="flex items-start gap-3 border-[3px] border-black bg-night-700 p-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={autoBalance}
              onChange={(e) => setAutoBalance(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[#ffd23f]"
            />
            <span>
              依人數自動調整魔王強度
              <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                以 30 人為基準，實際人數較少時會等比降低魔王 HP、攻擊力與能量門檻。
                小班（例如 5 人）也能公平遊玩；30 人以上維持原設定。
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 border-[3px] border-black bg-night-700 p-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={autoSkill}
              onChange={(e) => setAutoSkill(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[#ffd23f]"
            />
            <span>
              能量滿了自動釋放技能
              <span className="mt-1 block text-[11px] leading-relaxed text-muted">
                護盾與大招會在能量集滿時自動發動（魔王大招快落下時會優先開護盾）。
                關掉的話就要由老師手動按。
              </span>
            </span>
          </label>

          <p className="border-[3px] border-black bg-night-700 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
            不需要準備名單。學生掃 QR Code 後，直接輸入自己的座號與姓名就能加入；
            同一個座號只能有一個人使用。
          </p>
        </div>
      </PixelPanel>

      {error && (
        <p className="border-[3px] border-black bg-hp-dark px-4 py-3 text-sm text-white">{error}</p>
      )}

      <PixelButton size="xl" className="w-full" onClick={create}>
        建立遊戲並產生 QR Code
      </PixelButton>
    </div>
  )
}
