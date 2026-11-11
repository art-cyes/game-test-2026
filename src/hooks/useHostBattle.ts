import { useCallback, useEffect, useRef, useState } from 'react'
import { DEMO_QUESTIONS } from '@/config/demoQuestions'
import {
  BOSS_PRESETS,
  BOSS_ULT_WARN_SEC,
  TEAM_SKILLS,
  balanceFactor,
  calcDamage,
  calcEnergy,
} from '@/config/gameDefaults'
import { playSfx, stopBgm } from '@/lib/audio'
import type {
  AnswerPayload,
  BattleEvent,
  BattleState,
  PlayerBattleStats,
  QuestionPayload,
} from '@/lib/game/battle'
import { saveGameRecord } from '@/lib/game/history'
import type { GamePhase, PlayerSlot, Targeted } from '@/lib/game/lobby'
import { pickQuestion, prepareQuestion, type PreparedQuestion } from '@/lib/game/questionPicker'
import {
  computeAwards,
  sortByDamage,
  toStudentResult,
  type BattleOutcome,
} from '@/lib/game/results'
import { ROOM_EVENTS, type ConnectionStatus, type RealtimeAdapter } from '@/lib/realtime'
import type { GameRecord, GameSettings, Question } from '@/types'

const TICK_MS = 500
const CORRECT_COOLDOWN_MS = 300
const WRONG_COOLDOWN_MS = 2500
const EVENT_TTL_MS = 2600

interface PendingQuestion {
  prepared: PreparedQuestion
  index: number
  sentAt: number
}

export interface LiveEvent {
  id: number
  at: number
  event: BattleEvent
}


interface Options {
  adapter: RealtimeAdapter
  status: ConnectionStatus
  settings: GameSettings | null
  players: PlayerSlot[]
  phase: GamePhase
  questionPool?: Question[]
  /** 戰鬥結束時通知外層（用來切換階段） */
  onFinish?: (result: 'win' | 'lose') => void
}

/**
 * 老師端（遊戲主機）的戰鬥引擎。
 *
 * 唯一權威：所有傷害、血量、計時、出題都由這裡計算，再廣播給全班。
 */
export function useHostBattle({
  adapter,
  status,
  settings,
  players,
  phase,
  questionPool = DEMO_QUESTIONS,
  onFinish,
}: Options) {
  const [battle, setBattle] = useState<BattleState | null>(null)
  const [stats, setStats] = useState<PlayerBattleStats[]>([])
  const [events, setEvents] = useState<LiveEvent[]>([])
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null)
  const startedAtRef = useRef(0)

  const battleRef = useRef<BattleState | null>(null)
  const pendingRef = useRef<Map<string, PendingQuestion>>(new Map())
  const cooldownRef = useRef<Map<string, number>>(new Map())
  const statsRef = useRef<Map<string, PlayerBattleStats>>(new Map())
  const askCountRef = useRef<Map<string, number>>(new Map())
  const lastQuestionRef = useRef<Map<string, string>>(new Map())
  const eventSeqRef = useRef(0)
  const eventsRef = useRef<LiveEvent[]>([])

  const playersRef = useRef(players)
  playersRef.current = players
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const poolRef = useRef(questionPool)
  poolRef.current = questionPool
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const publish = useCallback(() => {
    if (battleRef.current) setBattle({ ...battleRef.current })
    setStats([...statsRef.current.values()].map((s) => ({ ...s })))
    setEvents([...eventsRef.current])
  }, [])

  const pushEvent = useCallback((event: BattleEvent) => {
    eventSeqRef.current += 1
    eventsRef.current = [
      ...eventsRef.current,
      { id: eventSeqRef.current, at: Date.now(), event },
    ].slice(-40)
  }, [])

  const broadcastState = useCallback(() => {
    if (!battleRef.current) return
    // remainingSec / nextAttackSec 一律由老師端時鐘換算
    const now = Date.now()
    battleRef.current.remainingSec = Math.max(0, Math.ceil((battleRef.current.endsAt - now) / 1000))
    battleRef.current.nextAttackSec = Math.max(
      0,
      Math.ceil((battleRef.current.nextAttackAt - now) / 1000),
    )
    battleRef.current.bossStunSec = Math.max(
      0,
      Math.ceil((battleRef.current.bossStunnedUntil - now) / 1000),
    )
    battleRef.current.bossUltSec = Math.max(
      0,
      Math.ceil((battleRef.current.bossUltAt - now) / 1000),
    )
    adapter.broadcast(ROOM_EVENTS.STATE, battleRef.current)
  }, [adapter])

  const getStat = useCallback((player: PlayerSlot): PlayerBattleStats => {
    let stat = statsRef.current.get(player.clientId)
    if (!stat) {
      stat = {
        seatNo: player.seatNo,
        name: player.name,
        role: player.role,
        correct: 0,
        wrong: 0,
        damage: 0,
        combo: 0,
        maxCombo: 0,
        totalSeconds: 0,
        defenseEnergy: 0,
        ultEnergy: 0,
      }
      statsRef.current.set(player.clientId, stat)
    } else {
      stat.seatNo = player.seatNo
      stat.name = player.name
      stat.role = player.role
    }
    return stat
  }, [])

  const finish = useCallback(
    (result: 'win' | 'lose', text: string) => {
      const b = battleRef.current
      if (!b || b.status !== 'running') return
      b.status = result
      pushEvent({ kind: 'info', text })
      stopBgm()
      playSfx(result === 'win' ? 'win' : 'lose')
      adapter.broadcast(ROOM_EVENTS.STATE, b)
      adapter.broadcast(ROOM_EVENTS.BATTLE_EVENT, { kind: 'info', text } satisfies BattleEvent)

      // 結算：排行榜 + 獎項
      const results = sortByDamage([...statsRef.current.values()].map(toStudentResult))
      const awards = computeAwards(results)
      const endedAt = Date.now()
      const payload: BattleOutcome = { result, results, awards, endedAt }
      setOutcome(payload)
      adapter.broadcast(ROOM_EVENTS.RESULTS, payload)

      // 存歷史紀錄
      const s = settingsRef.current
      if (s) {
        const record: GameRecord = {
          id: `g-${endedAt.toString(36)}`,
          className: s.className,
          bossDifficulty: s.bossDifficulty,
          startTime: startedAtRef.current || endedAt,
          endTime: endedAt,
          result,
          students: results,
          settingsSnapshot: s,
        }
        try {
          saveGameRecord(record)
        } catch (err) {
          console.warn('[useHostBattle] 儲存歷史紀錄失敗', err)
        }
      }

      adapter.broadcast(ROOM_EVENTS.PHASE, { phase: 'result' })
      onFinishRef.current?.(result)
      publish()
    },
    [adapter, publish, pushEvent],
  )

  const sendQuestion = useCallback(
    (player: PlayerSlot) => {
      const q = pickQuestion(poolRef.current, lastQuestionRef.current.get(player.clientId) ?? null)
      if (!q) return
      const prepared = prepareQuestion(q)
      const index = (askCountRef.current.get(player.clientId) ?? 0) + 1
      askCountRef.current.set(player.clientId, index)
      lastQuestionRef.current.set(player.clientId, q.id)
      pendingRef.current.set(player.clientId, { prepared, index, sentAt: Date.now() })

      const payload: QuestionPayload = {
        index,
        questionId: q.id,
        stem: q.stem,
        options: prepared.options,
        difficulty: q.difficulty,
        imageRef: q.imageRef,
      }
      const msg: Targeted<QuestionPayload> = { target: player.clientId, data: payload }
      adapter.broadcast(ROOM_EVENTS.QUESTION, msg)
    },
    [adapter],
  )

  const applyBossAttack = useCallback(() => {
    const b = battleRef.current
    const s = settingsRef.current
    if (!b || !s || b.status !== 'running') return

    const power = b.bossAttackPower
    pushEvent({ kind: 'boss-attack', amount: power, text: '魔王發動攻擊！' })
    playSfx('bossAttack')
    adapter.broadcast(ROOM_EVENTS.BATTLE_EVENT, {
      kind: 'boss-attack',
      amount: power,
    } satisfies BattleEvent)

    // 有護盾時先由護盾吸收
    if (b.shieldHp > 0) {
      const absorbed = Math.min(b.shieldHp, power)
      b.shieldHp -= absorbed
      const overflow = power - absorbed
      if (overflow > 0) b.teamHp = Math.max(0, b.teamHp - overflow)
      playSfx('block')
      adapter.broadcast(ROOM_EVENTS.BATTLE_EVENT, {
        kind: 'block',
        amount: absorbed,
      } satisfies BattleEvent)
    } else {
      b.teamHp = Math.max(0, b.teamHp - power)
    }

    if (b.teamHp <= 0) finish('lose', '團隊血條見底了…勇者們倒下了。')
  }, [adapter, finish, pushEvent])

  /** 魔王大招：護盾能扛下，沒護盾就重傷 */
  const applyBossUlt = useCallback(() => {
    const b = battleRef.current
    if (!b || b.status !== 'running') return

    const power = b.bossUltPower
    const payload = {
      kind: 'boss-ult',
      amount: power,
      text: `魔王大招「${b.bossUltName}」！`,
    } satisfies BattleEvent
    pushEvent(payload)
    playSfx('bossUlt')
    adapter.broadcast(ROOM_EVENTS.BATTLE_EVENT, payload)

    if (b.shieldHp > 0) {
      const absorbed = Math.min(b.shieldHp, power)
      b.shieldHp -= absorbed
      const overflow = power - absorbed
      if (overflow > 0) b.teamHp = Math.max(0, b.teamHp - overflow)
      playSfx('block')
      adapter.broadcast(ROOM_EVENTS.BATTLE_EVENT, {
        kind: 'block',
        amount: absorbed,
      } satisfies BattleEvent)
    } else {
      b.teamHp = Math.max(0, b.teamHp - power)
    }

    if (b.teamHp <= 0) finish('lose', '魔王大招命中，團隊血條見底了…')
  }, [adapter, finish, pushEvent])

  /** 釋放防禦技能：展開全隊護盾 */
  const castDefense = useCallback(() => {
    const b = battleRef.current
    if (!b || b.status !== 'running') return false
    if (b.defenseEnergy < b.defenseThreshold) return false

    b.defenseEnergy -= b.defenseThreshold
    b.shieldHp = b.shieldMax
    b.defenseUsed += 1
    const payload = {
      kind: 'skill-defense',
      amount: b.shieldMax,
      text: `「${TEAM_SKILLS.defense.name}」展開！可吸收 ${b.shieldMax} 點傷害`,
    } satisfies BattleEvent
    pushEvent(payload)
    playSfx('skillDefense')
    adapter.broadcast(ROOM_EVENTS.BATTLE_EVENT, payload)
    broadcastState()
    publish()
    return true
  }, [adapter, broadcastState, publish, pushEvent])

  /** 釋放大招：重創魔王並使其暈眩 */
  const castUlt = useCallback(() => {
    const b = battleRef.current
    const s = settingsRef.current
    if (!b || !s || b.status !== 'running') return false
    if (b.ultEnergy < b.ultThreshold) return false

    const damage = Math.max(1, Math.round(s.ultDamage * b.balanceFactor))
    const dealt = Math.min(b.bossHp, damage)
    b.ultEnergy -= b.ultThreshold
    b.ultUsed += 1
    b.bossHp = Math.max(0, b.bossHp - damage)

    const stunUntil = Date.now() + s.ultStunSec * 1000
    b.bossStunnedUntil = Math.max(b.bossStunnedUntil, stunUntil)
    // 暈眩結束後再重新計算下一次攻擊，避免醒來立刻打人
    b.nextAttackAt = Math.max(b.nextAttackAt, stunUntil + s.bossAttackIntervalSec * 1000)
    // 大招也順延，並取消已發出的預告
    if (b.bossUltAt < stunUntil) {
      b.bossUltAt = stunUntil + s.bossUltIntervalSec * 1000
      b.bossUltWarned = false
    }

    const payload = {
      kind: 'skill-ult',
      amount: dealt,
      text: `「${TEAM_SKILLS.ult.name}」！造成 ${dealt} 傷害，魔王暈眩 ${s.ultStunSec} 秒`,
    } satisfies BattleEvent
    pushEvent(payload)
    playSfx('skillUlt')
    adapter.broadcast(ROOM_EVENTS.BATTLE_EVENT, payload)

    if (b.bossHp <= 0) {
      broadcastState()
      finish('win', '魔王被打倒了！勇者們勝利！')
      return true
    }
    broadcastState()
    publish()
    return true
  }, [adapter, broadcastState, finish, publish, pushEvent])

  const start = useCallback(() => {
    const s = settingsRef.current
    if (!s) return
    const now = Date.now()

    // 依實際人數平衡魔王強度與能量門檻
    const playerCount = Math.max(1, playersRef.current.length)
    const k = s.autoBalance ? balanceFactor(playerCount) : 1
    const bossHp = Math.max(1, Math.round(s.bossHp * k))
    // 攻擊力不隨人數縮放：隊伍血條是固定值，若攻擊力跟著人數下降，小班永遠打不死人
    const bossAttackPower = Math.max(1, Math.round(s.bossAttackPower))
    const defenseThreshold = Math.max(10, Math.round(s.defenseThreshold * k))
    const ultThreshold = Math.max(10, Math.round(s.ultThreshold * k))

    const state: BattleState = {
      status: 'running',
      bossHp,
      bossHpMax: bossHp,
      teamHp: s.teamHp,
      teamHpMax: s.teamHp,
      defenseEnergy: 0,
      defenseThreshold,
      ultEnergy: 0,
      ultThreshold,
      shieldHp: 0,
      shieldMax: Math.max(1, Math.round(s.defenseShield * k)),
      bossStunnedUntil: 0,
      bossStunSec: 0,
      bossAttackPower,
      bossName: BOSS_PRESETS[s.bossDifficulty].name,
      bossUltName: BOSS_PRESETS[s.bossDifficulty].ultName,
      bossUltAt: now + s.bossUltIntervalSec * 1000,
      bossUltSec: s.bossUltIntervalSec,
      bossUltIntervalSec: s.bossUltIntervalSec,
      bossUltPower: Math.max(1, Math.round(s.bossAttackPower * s.bossUltMultiplier)),
      bossUltWarned: false,
      balanceFactor: k,
      defenseUsed: 0,
      ultUsed: 0,
      remainingSec: s.durationSec,
      totalSec: s.durationSec,
      nextAttackSec: s.bossAttackIntervalSec,
      endsAt: now + s.durationSec * 1000,
      nextAttackAt: now + s.bossAttackIntervalSec * 1000,
      totalCorrect: 0,
      totalWrong: 0,
    }
    battleRef.current = state
    startedAtRef.current = now
    pendingRef.current = new Map()
    cooldownRef.current = new Map()
    statsRef.current = new Map()
    askCountRef.current = new Map()
    lastQuestionRef.current = new Map()
    eventsRef.current = []
    setOutcome(null)
    // 預先為目前所有學生建立統計
    for (const p of playersRef.current) getStat(p)
    pushEvent({ kind: 'info', text: '戰鬥開始！' })
    adapter.broadcast(ROOM_EVENTS.STATE, state)
    publish()
  }, [adapter, getStat, publish, pushEvent])

  /** 老師提前結束戰鬥 */
  const endBattle = useCallback(() => {
    finish('lose', '老師提前結束了這場戰鬥。')
  }, [finish])

  const reset = useCallback(() => {
    battleRef.current = null
    pendingRef.current = new Map()
    cooldownRef.current = new Map()
    eventsRef.current = []
    setBattle(null)
    setEvents([])
    setOutcome(null)
  }, [])

  /* ---------------- 開始 / 重置 ---------------- */

  useEffect(() => {
    if (phase === 'battle' && status === 'connected') {
      // 只在尚未開始時啟動，避免戰鬥結束後重連又重打一次
      if (battleRef.current === null) start()
    } else if (phase === 'lobby') {
      reset()
    }
  }, [phase, status, start, reset])

  /* ---------------- 收到的作答 ---------------- */

  useEffect(() => {
    if (status !== 'connected') return
    const off = adapter.on<AnswerPayload>(ROOM_EVENTS.ANSWER, (answer, sender) => {
      const b = battleRef.current
      const s = settingsRef.current
      if (!b || !s || b.status !== 'running' || !answer) return

      const clientId = sender.clientId
      const entry = pendingRef.current.get(clientId)
      if (!entry || entry.prepared.question.id !== answer.questionId) return

      const player = playersRef.current.find((p) => p.clientId === clientId)
      if (!player) return

      pendingRef.current.delete(clientId)
      const stat = getStat(player)
      const diff = entry.prepared.question.difficulty
      stat.totalSeconds += Math.max(0, Number(answer.seconds) || 0)

      const correct = answer.choiceIndex === entry.prepared.answerIndex

      if (correct) {
        stat.correct += 1
        stat.combo += 1
        stat.maxCombo = Math.max(stat.maxCombo, stat.combo)
        const dmg = calcDamage(diff, player.role, stat.combo, s.damage)
        stat.damage += dmg
        b.bossHp = Math.max(0, b.bossHp - dmg)
        b.totalCorrect += 1
        const energy = calcEnergy(diff, player.role)
        b.defenseEnergy += energy.defense
        b.ultEnergy += energy.ult
        stat.defenseEnergy += energy.defense
        stat.ultEnergy += energy.ult
        pushEvent({
          kind: 'damage',
          seatNo: player.seatNo,
          name: player.name,
          amount: dmg,
          combo: stat.combo,
        })
        adapter.broadcast(ROOM_EVENTS.BATTLE_EVENT, {
          kind: 'damage',
          seatNo: player.seatNo,
          name: player.name,
          amount: dmg,
          combo: stat.combo,
        } satisfies BattleEvent)
        cooldownRef.current.set(clientId, Date.now() + CORRECT_COOLDOWN_MS)
      } else {
        stat.wrong += 1
        stat.combo = 0
        b.totalWrong += 1
        pushEvent({ kind: 'wrong', seatNo: player.seatNo, name: player.name })
        adapter.broadcast(ROOM_EVENTS.BATTLE_EVENT, {
          kind: 'wrong',
          seatNo: player.seatNo,
          name: player.name,
        } satisfies BattleEvent)
        cooldownRef.current.set(clientId, Date.now() + WRONG_COOLDOWN_MS)
      }

      if (b.bossHp <= 0) {
        broadcastState()
        finish('win', '魔王被打倒了！勇者們勝利！')
        return
      }
      broadcastState()
      publish()
    })
    return off
  }, [adapter, status, broadcastState, finish, getStat, publish, pushEvent])

  /* ---------------- 主循環 ---------------- */

  useEffect(() => {
    if (status !== 'connected' || phase !== 'battle') return

    const id = setInterval(() => {
      const b = battleRef.current
      const s = settingsRef.current
      if (!b || !s || b.status !== 'running') return

      const now = Date.now()

      // 魔王攻擊
      // 註：一律以「現在時間 + 間隔」重算，避免分頁被瀏覽器節流後
      //     補償式地連續攻擊（也避免計時器異常時暴走）
      // 魔王暈眩期間不攻擊
      if (now >= b.nextAttackAt && now >= b.bossStunnedUntil) {
        b.nextAttackAt = now + s.bossAttackIntervalSec * 1000
        applyBossAttack()
      }

      // 魔王大招：先預告，再落下
      if (!b.bossUltWarned && b.bossUltAt - now <= BOSS_ULT_WARN_SEC * 1000 && b.bossUltAt > now) {
        b.bossUltWarned = true
        const warn = {
          kind: 'boss-ult-warning',
          amount: b.bossUltPower,
          text: `魔王大招「${b.bossUltName}」${Math.max(1, Math.ceil((b.bossUltAt - now) / 1000))} 秒後落下！`,
        } satisfies BattleEvent
        pushEvent(warn)
        playSfx('bossUltWarning')
        adapter.broadcast(ROOM_EVENTS.BATTLE_EVENT, warn)
      }
      if (now >= b.bossUltAt) {
        b.bossUltAt = now + s.bossUltIntervalSec * 1000
        b.bossUltWarned = false
        applyBossUlt()
      }

      // 派題給還沒拿到題目的學生
      const present = new Set(playersRef.current.map((p) => p.clientId))
      for (const key of [...pendingRef.current.keys()]) {
        if (!present.has(key)) pendingRef.current.delete(key)
      }
      for (const p of playersRef.current) {
        if (battleRef.current?.status !== 'running') break
        if (pendingRef.current.has(p.clientId)) continue
        if ((cooldownRef.current.get(p.clientId) ?? 0) > now) continue
        sendQuestion(p)
      }

      // 自動釋放技能（能量滿了就放；魔王大招快落下時優先開護盾）
      if (s.autoSkill && battleRef.current?.status === 'running') {
        const ultImminent = b.bossUltAt - now <= BOSS_ULT_WARN_SEC * 1000
        if (ultImminent && b.defenseEnergy >= b.defenseThreshold) {
          castDefense()
        } else if (b.ultEnergy >= b.ultThreshold) {
          castUlt()
        } else if (b.defenseEnergy >= b.defenseThreshold) {
          castDefense()
        }
      }

      // 時間到
      if (b.endsAt - now <= 0) {
        broadcastState()
        finish('lose', '時間到了，魔王還沒倒下…')
        return
      }

      // 清掉過期的事件
      eventsRef.current = eventsRef.current.filter((e) => now - e.at < EVENT_TTL_MS)

      broadcastState()
      publish()
    }, TICK_MS)

    return () => clearInterval(id)
  }, [
    adapter,
    status,
    phase,
    applyBossAttack,
    applyBossUlt,
    broadcastState,
    finish,
    publish,
    pushEvent,
    sendQuestion,
    castDefense,
    castUlt,
  ])

  return { battle, stats, events, outcome, start, reset, endBattle, castDefense, castUlt }
}
