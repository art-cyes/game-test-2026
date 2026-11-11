/**
 * 結算：把戰鬥統計轉成排行榜、獎項與報表
 */

import Papa from 'papaparse'
import type { PlayerBattleStats } from './battle'
import { ROLE_LABEL, type BossDifficulty, type StudentResult } from '@/types'

/** 至少要有幾題才會列入正確率／速度的獎項評比 */
const MIN_ANSWERS_FOR_RATE = 3

export function toStudentResult(stats: PlayerBattleStats): StudentResult {
  const total = stats.correct + stats.wrong
  return {
    seatNo: stats.seatNo,
    name: stats.name,
    role: stats.role ?? 'warrior',
    correct: stats.correct,
    wrong: stats.wrong,
    total,
    accuracy: total > 0 ? stats.correct / total : 0,
    damage: stats.damage,
    defenseEnergy: stats.defenseEnergy ?? 0,
    ultEnergy: stats.ultEnergy ?? 0,
    avgSeconds: stats.correct > 0 ? stats.totalSeconds / stats.correct : 0,
    maxCombo: stats.maxCombo,
    onlineSeconds: 0,
  }
}

/* ------------------------------------------------------------------ */
/* 獎項                                                                */
/* ------------------------------------------------------------------ */

export interface Award {
  id: string
  title: string
  emoji: string
  seatNo: string
  name: string
  detail: string
}

/** 戰鬥結束後廣播給全班的結算內容 */
export interface BattleOutcome {
  result: 'win' | 'lose'
  results: StudentResult[]
  awards: Award[]
  endedAt: number
}

interface AwardRule {
  id: string
  title: string
  emoji: string
  /** 分數越高越好；回傳 null 表示這個人沒有資格 */
  score: (r: StudentResult) => number | null
  detail: (r: StudentResult) => string
}

const RULES: AwardRule[] = [
  {
    id: 'warrior',
    title: '最強戰士',
    emoji: '⚔️',
    score: (r) => (r.damage > 0 ? r.damage : null),
    detail: (r) => `總傷害 ${r.damage}`,
  },
  {
    id: 'guardian',
    title: '最佳防禦手',
    emoji: '🛡️',
    score: (r) => (r.defenseEnergy > 0 ? r.defenseEnergy : null),
    detail: (r) => `防禦貢獻 ${r.defenseEnergy}`,
  },
  {
    id: 'sorcerer',
    title: '大招功臣',
    emoji: '🔥',
    score: (r) => (r.ultEnergy > 0 ? r.ultEnergy : null),
    detail: (r) => `大招貢獻 ${r.ultEnergy}`,
  },
  {
    id: 'sniper',
    title: '神射手',
    emoji: '🎯',
    score: (r) => (r.total >= MIN_ANSWERS_FOR_RATE ? r.accuracy : null),
    detail: (r) => `正確率 ${Math.round(r.accuracy * 100)}%`,
  },
  {
    id: 'speedster',
    title: '快手',
    emoji: '⚡',
    score: (r) => (r.total >= MIN_ANSWERS_FOR_RATE && r.avgSeconds > 0 ? -r.avgSeconds : null),
    detail: (r) => `平均 ${r.avgSeconds.toFixed(1)} 秒`,
  },
  {
    id: 'combo',
    title: '連擊王',
    emoji: '💥',
    score: (r) => (r.maxCombo > 1 ? r.maxCombo : null),
    detail: (r) => `最高連擊 x${r.maxCombo}`,
  },
]

export function computeAwards(results: StudentResult[]): Award[] {
  if (results.length === 0) return []
  const awards: Award[] = []

  for (const rule of RULES) {
    let best: StudentResult | null = null
    let bestScore = -Infinity
    for (const r of results) {
      const s = rule.score(r)
      if (s === null) continue
      if (s > bestScore) {
        bestScore = s
        best = r
      }
    }
    if (best) {
      awards.push({
        id: rule.id,
        title: rule.title,
        emoji: rule.emoji,
        seatNo: best.seatNo,
        name: best.name,
        detail: rule.detail(best),
      })
    }
  }

  const mvp = computeMvp(results)
  if (mvp) {
    awards.unshift({
      id: 'mvp',
      title: 'MVP',
      emoji: '🏆',
      seatNo: mvp.r.seatNo,
      name: mvp.r.name,
      detail: `綜合積分 ${mvp.score.toFixed(1)}`,
    })
  }

  return awards
}

/** 綜合加權：傷害 50%、正確率 30%、連擊 20% */
export function computeMvp(
  results: StudentResult[],
): { r: StudentResult; score: number } | null {
  if (results.length === 0) return null
  const maxDamage = Math.max(...results.map((r) => r.damage), 1)
  const maxCombo = Math.max(...results.map((r) => r.maxCombo), 1)

  let best: StudentResult | null = null
  let bestScore = -Infinity
  for (const r of results) {
    const score =
      (r.damage / maxDamage) * 50 + r.accuracy * 30 + (r.maxCombo / maxCombo) * 20
    if (score > bestScore) {
      bestScore = score
      best = r
    }
  }
  return best ? { r: best, score: bestScore } : null
}

/* ------------------------------------------------------------------ */
/* 報表                                                                */
/* ------------------------------------------------------------------ */

export const REPORT_HEADERS = [
  '名次',
  '座號',
  '姓名',
  '角色',
  '答對',
  '答錯',
  '總題數',
  '正確率',
  '總傷害',
  '防禦貢獻',
  '大招貢獻',
  '最高連擊',
  '平均作答秒數',
  '獲獎',
] as const

export function resultsToCsv(results: StudentResult[], awards: Award[] = []): string {
  const awardMap = new Map<string, string[]>()
  for (const a of awards) {
    const list = awardMap.get(a.seatNo) ?? []
    list.push(a.title)
    awardMap.set(a.seatNo, list)
  }
  const rows = results.map((r, i) => ({
    名次: i + 1,
    座號: r.seatNo,
    姓名: r.name,
    角色: ROLE_LABEL[r.role] ?? '',
    答對: r.correct,
    答錯: r.wrong,
    總題數: r.total,
    正確率: `${Math.round(r.accuracy * 100)}%`,
    總傷害: r.damage,
    防禦貢獻: r.defenseEnergy,
    大招貢獻: r.ultEnergy,
    最高連擊: r.maxCombo,
    平均作答秒數: r.avgSeconds.toFixed(1),
    獲獎: (awardMap.get(r.seatNo) ?? []).join('／'),
  }))
  return `\uFEFF${Papa.unparse(rows, { columns: [...REPORT_HEADERS] })}`
}

export function sortByDamage(results: StudentResult[]): StudentResult[] {
  return [...results].sort((a, b) => b.damage - a.damage || a.seatNo.localeCompare(b.seatNo))
}

export function resultFileName(
  className: string,
  bossDifficulty: BossDifficulty,
  endedAt: number,
): string {
  const d = new Date(endedAt)
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  const safeClass = className.replace(/[\\/:*?"<>|]/g, '_') || '班級'
  return `${safeClass}_${bossDifficulty}_${stamp}.csv`
}
