import { useEffect, useState } from 'react'
import { AnimatedBoss } from '@/components/AnimatedBoss'
import { AnimatedHero, type ActorState } from '@/components/AnimatedHero'
import { SkillEffect, SlashBurst } from '@/components/SkillEffect'
import { StatBar } from '@/components/StatBar'
import { useSkillEffect } from '@/hooks/useSkillEffect'
import type { AnswerFeedback, SkillNotice } from '@/hooks/useStudentBattle'
import type { BattleState, QuestionPayload } from '@/lib/game/battle'
import { BOSS_ULT_WARN_SEC } from '@/config/gameDefaults'

import { DIFFICULTY_LABEL, type BossDifficulty, type Difficulty, type Role } from '@/types'

interface Props {
  name: string
  role: Role
  bossDifficulty: BossDifficulty
  battle: BattleState | null
  question: (QuestionPayload & { shownAt: number }) | null
  answered: boolean
  feedback: AnswerFeedback | null
  shakeToken: number
  skillNotice: SkillNotice | null
  onAnswer: (choiceIndex: number) => void
}

const LETTERS = ['A', 'B', 'C', 'D']

const DIFFICULTY_CLASS: Record<Difficulty, string> = {
  1: 'bg-guard text-night-900',
  2: 'bg-gold text-night-900',
  3: 'bg-hp text-white',
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function StudentBattleScreen({
  name,
  role,
  bossDifficulty,
  battle,
  question,
  answered,
  feedback,
  shakeToken,
  skillNotice,
  onAnswer,
}: Props) {
  const [chosen, setChosen] = useState<number | null>(null)
  const [shaking, setShaking] = useState(false)

  // 換新題目就清掉上一題的選擇
  useEffect(() => {
    setChosen(null)
  }, [question?.questionId])

  useEffect(() => {
    if (shakeToken === 0) return
    setShaking(true)
    const t = setTimeout(() => setShaking(false), 460)
    return () => clearTimeout(t)
  }, [shakeToken])

  // 與投影畫面同步的技能特效
  const fx = useSkillEffect(skillNotice ? { kind: skillNotice.kind, id: skillNotice.at } : null, 1300)
  // 自己的角色動作：答對 → 攻擊、答錯 → 受擊、技能 → 施法
  const heroState: ActorState =
    fx === 'shield' || fx === 'ult'
      ? 'cast'
      : feedback
        ? feedback.correct
          ? 'attack'
          : 'hurt'
        : 'idle'

  const choose = (index: number) => {
    if (answered || chosen !== null) return
    setChosen(index)
    onAnswer(index)
  }

  return (
    <div
      className={[
        'game-surface mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 py-5',
        shaking ? 'animate-shake' : '',
      ].join(' ')}
    >
      {/* 技能特效（與投影同步） */}
      {fx && <SkillEffect kind={fx} className="fixed" />}
      {feedback?.correct && !fx && (
        <SlashBurst key={feedback.at} seed={feedback.at % 1000} className="fixed" />
      )}

      {/* 頂部：迷你戰場（與投影同步） */}
      <div className="rpg-panel flex items-center gap-3">
        <AnimatedBoss
          difficulty={bossDifficulty}
          state={
            (battle?.bossStunSec ?? 0) > 0
              ? 'hurt'
              : battle?.status === 'win'
                ? 'down'
                : fx === 'bossUlt'
                  ? 'cast'
                  : 'idle'
          }
          size={100}
          title="魔王"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <StatBar
            label={battle?.bossName ?? '魔王'}
            value={battle?.bossHp ?? 0}
            max={battle?.bossHpMax ?? 1}
            colorClass="bg-hp"
            size="sm"
          />
          {(battle?.bossStunSec ?? 0) > 0 && (
            <p className="font-pixel text-sm text-mana">💫 魔王暈眩 {battle?.bossStunSec}s</p>
          )}
          {(battle?.shieldHp ?? 0) > 0 && (
            <p className="font-pixel text-sm text-mana">🛡 護盾 {battle?.shieldHp}</p>
          )}
        </div>
        <div className="shrink-0 border-[3px] border-black bg-night-700 px-3 py-2 text-center">
          <p className="font-pixel text-base tabular-nums text-gold">
            {formatTime(battle?.remainingSec ?? 0)}
          </p>
        </div>
      </div>

      {/* 魔王大招警告（與投影同步） */}
      {battle &&
        (battle.bossUltSec ?? 0) > 0 &&
        battle.bossUltSec <= BOSS_ULT_WARN_SEC && (
          <div className="animate-pulse-soft border-[3px] border-black bg-hp px-3 py-2.5 text-center">
            <p className="font-pixel text-sm leading-relaxed text-white">
              ⚠ 魔王大招「{battle.bossUltName}」{battle.bossUltSec} 秒後落下！
            </p>
            <p className="mt-1.5 text-xs text-white/90">
              {(battle.shieldHp ?? 0) > 0
                ? `目前護盾 ${battle.shieldHp}，可以扛下！`
                : '現在沒有護盾，快答題累積防禦能量！'}
            </p>
          </div>
        )}

      <div className="flex items-center justify-between text-sm text-muted">
        <span className="flex items-center gap-1">
          <AnimatedHero role={role} state={heroState} size={44} />
          {name}
        </span>
        <span>
          答對 <span className="font-pixel text-base text-guard">{battle?.totalCorrect ?? 0}</span>
          　答錯 <span className="font-pixel text-base text-hp">{battle?.totalWrong ?? 0}</span>
        </span>
      </div>

      {/* 大字幕（與投影同步） */}
      {skillNotice && Date.now() - skillNotice.at < 3000 && (
        <p className="font-pixel animate-pulse-soft border-[3px] border-black bg-gold px-3 py-3 text-center text-base leading-relaxed text-night-900 pixel-frame">
          {skillNotice.text}
        </p>
      )}

      {/* 回饋 */}
      <div className="min-h-7 text-center">
        {feedback && (
          <p
            className={`font-pixel text-base ${
              feedback.correct ? 'text-guard' : 'text-hp'
            } animate-pulse-soft`}
          >
            {feedback.correct
              ? `✓ 答對了　-${feedback.amount}${feedback.combo && feedback.combo >= 3 ? `　連擊 x${feedback.combo}` : ''}`
              : '✗ 再接再厲！'}
          </p>
        )}
      </div>

      {!question ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <span className="animate-float">
            <AnimatedHero role={role} state={heroState} size={150} />
          </span>
          <p className="font-pixel animate-pulse-soft text-base text-gold">準備下一題…</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="font-pixel text-sm text-muted">第 {question.index} 題</span>
            <span
              className={`font-pixel border-[3px] border-black px-3 py-1 text-sm ${
                DIFFICULTY_CLASS[question.difficulty]
              }`}
            >
              {DIFFICULTY_LABEL[question.difficulty]}
            </span>
          </div>

          <div className="rpg-panel">
            {question.imageRef && (
              <img
                src={question.imageRef}
                alt="題目圖片"
                className="mb-4 w-full rounded-none border-[3px] border-black"
              />
            )}
            <p className="text-lg leading-relaxed text-ink">{question.stem}</p>
          </div>

          <div className="grid gap-3">
            {question.options.map((opt, i) => {
              const isChosen = chosen === i
              const dimmed = chosen !== null && !isChosen
              return (
                <button
                  key={i}
                  type="button"
                  disabled={answered || chosen !== null}
                  onClick={() => choose(i)}
                  className={[
                    'flex items-center gap-3 border-[3px] border-black px-4 py-4 text-left transition',
                    'pixel-3d disabled:cursor-not-allowed',
                    isChosen ? 'bg-gold text-night-900' : 'bg-night-700 text-ink hover:bg-night-600',
                    dimmed ? 'opacity-40' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'font-pixel flex size-10 shrink-0 items-center justify-center border-[3px] border-black text-base',
                      isChosen ? 'bg-night-900 text-gold' : 'bg-night-900 text-muted',
                    ].join(' ')}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="text-lg leading-snug">{opt}</span>
                </button>
              )
            })}
          </div>

          {chosen !== null && (
            <p className="text-center font-pixel text-sm text-muted">已送出，等待結果…</p>
          )}
        </>
      )}
    </div>
  )
}
