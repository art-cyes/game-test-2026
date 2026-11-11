/**
 * 出題工具：抽題與選項打亂
 */

import type { Difficulty, Question } from '@/types'

/** 已為某位學生準備好的題目（選項已打亂、正解索引已更新） */
export interface PreparedQuestion {
  question: Question
  /** 打亂後的選項 */
  options: string[]
  /** 打亂後的正解索引 */
  answerIndex: number
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 抽一題，盡量不要連續出同一題。
 * pool 為空時回傳 null。
 */
export function pickQuestion(pool: Question[], avoidId?: string | null): Question | null {
  if (pool.length === 0) return null

  const candidates = pool.length > 1 && avoidId ? pool.filter((q) => q.id !== avoidId) : pool
  const list = candidates.length > 0 ? candidates : pool
  return list[Math.floor(Math.random() * list.length)]
}

/** 打亂選項，並回傳新的正解索引 */
export function prepareQuestion(question: Question): PreparedQuestion {
  const correctText = question.options[question.answerIndex]
  const options = shuffle(question.options)
  const answerIndex = options.indexOf(correctText)
  return { question, options, answerIndex }
}

/** 統計題庫中各難度的題數 */
export function countByDifficulty(pool: Question[]): Record<Difficulty, number> {
  const result: Record<Difficulty, number> = { 1: 0, 2: 0, 3: 0 }
  for (const q of pool) result[q.difficulty] += 1
  return result
}
