import { useCallback, useEffect, useState } from 'react'
import type { BattleEvent, BattleState, QuestionPayload } from '@/lib/game/battle'
import type { Targeted } from '@/lib/game/lobby'
import type { BattleOutcome } from '@/lib/game/results'
import { playSfx } from '@/lib/audio'
import { ROOM_EVENTS, type ConnectionStatus, type RealtimeAdapter } from '@/lib/realtime'
import type { StudentIdentity } from './useStudentSession'

export interface AnswerFeedback {
  correct: boolean
  amount?: number
  combo?: number
  at: number
}

export interface SkillNotice {
  text: string
  /** 事件種類（skill-defense / skill-ult / block） */
  kind: string
  at: number
}

interface Options {
  adapter: RealtimeAdapter
  status: ConnectionStatus
  identity: StudentIdentity | null
}

/**
 * 學生端：接收老師端派來的題目、回報作答、顯示戰鬥狀態。
 */
export function useStudentBattle({ adapter, status, identity }: Options) {
  const [battle, setBattle] = useState<BattleState | null>(null)
  const [question, setQuestion] = useState<(QuestionPayload & { shownAt: number }) | null>(null)
  const [answered, setAnswered] = useState(false)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  /** 每次魔王攻擊就 +1，用來觸發畫面震動 */
  const [shakeToken, setShakeToken] = useState(0)
  /** 最近一則公告（例如戰鬥結束原因） */
  const [notice, setNotice] = useState('')
  /** 技能相關的短暫提示（帶事件種類，用來播放特效） */
  const [skillNotice, setSkillNotice] = useState<SkillNotice | null>(null)
  /** 結算結果（排行榜與獎項） */
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null)

  useEffect(() => {
    if (status !== 'connected' || !identity) return
    const selfId = adapter.selfId

    const offState = adapter.on<BattleState>(ROOM_EVENTS.STATE, (payload) => {
      if (payload) setBattle(payload)
    })

    const offQuestion = adapter.on<Targeted<QuestionPayload>>(ROOM_EVENTS.QUESTION, (payload) => {
      if (!payload || payload.target !== selfId) return
      setQuestion({ ...payload.data, shownAt: Date.now() })
      setAnswered(false)
      setFeedback(null)
    })

    const offEvent = adapter.on<BattleEvent>(ROOM_EVENTS.BATTLE_EVENT, (payload) => {
      if (!payload) return
      if (payload.kind === 'boss-attack') {
        setShakeToken((n) => n + 1)
        playSfx('bossAttack')
        return
      }
      if (payload.kind === 'info') {
        if (payload.text) setNotice(payload.text)
        return
      }
      if (payload.kind === 'skill-defense' || payload.kind === 'skill-ult') {
        if (payload.text) setSkillNotice({ text: payload.text, kind: payload.kind, at: Date.now() })
        setShakeToken((n) => n + 1)
        playSfx(payload.kind === 'skill-ult' ? 'skillUlt' : 'skillDefense')
        return
      }
      if (payload.kind === 'boss-ult') {
        setSkillNotice({
          text: `💥 魔王大招「${payload.text ?? ''}」`,
          kind: 'boss-ult',
          at: Date.now(),
        })
        setShakeToken((n) => n + 1)
        return
      }
      if (payload.kind === 'block') {
        setSkillNotice({ text: `🛡 護盾擋下了 ${payload.amount} 點傷害`, kind: 'block', at: Date.now() })
        playSfx('block')
        return
      }
      if (payload.seatNo !== identity.seatNo) return
      if (payload.kind === 'damage') {
        setFeedback({ correct: true, amount: payload.amount, combo: payload.combo, at: Date.now() })
        playSfx('correct')
      } else if (payload.kind === 'wrong') {
        setFeedback({ correct: false, at: Date.now() })
        playSfx('wrong')
      }
    })

    const offResults = adapter.on<BattleOutcome>(ROOM_EVENTS.RESULTS, (payload) => {
      if (payload) {
        setOutcome(payload)
        playSfx(payload.result === 'win' ? 'win' : 'lose')
      }
    })

    return () => {
      offState()
      offQuestion()
      offEvent()
      offResults()
    }
  }, [adapter, status, identity])

  const answer = useCallback(
    (choiceIndex: number) => {
      if (!question || answered) return
      setAnswered(true)
      adapter.broadcast(ROOM_EVENTS.ANSWER, {
        questionId: question.questionId,
        choiceIndex,
        seconds: (Date.now() - question.shownAt) / 1000,
      })
    },
    [adapter, question, answered],
  )

  return { battle, question, answered, feedback, shakeToken, notice, skillNotice, outcome, answer }
}
