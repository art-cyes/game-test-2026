/**
 * 題庫的存取與驗證
 *
 * 題庫（含圖片 data URL）存在 IndexedDB，容量比 localStorage 大得多，
 * 也不會在老師重新整理或關閉瀏覽器後消失。
 */

import { idbDelete, idbGet, idbSet } from '@/lib/storage/idb'
import type { Difficulty, Question } from '@/types'

const BANK_KEY = 'question-bank'
const MAX_OPTIONS = 4

export function newQuestionId(): string {
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === 1 || value === 2 || value === 3
}

/** 檢查一筆資料是否是合法的題目 */
export function isValidQuestion(value: unknown): value is Question {
  if (!value || typeof value !== 'object') return false
  const q = value as Record<string, unknown>
  if (typeof q.id !== 'string' || !q.id) return false
  if (typeof q.stem !== 'string' || !q.stem.trim()) return false
  if (!Array.isArray(q.options) || q.options.length !== MAX_OPTIONS) return false
  if (!q.options.every((o) => typeof o === 'string' && o.trim())) return false
  if (typeof q.answerIndex !== 'number') return false
  if (q.answerIndex < 0 || q.answerIndex >= MAX_OPTIONS) return false
  if (!isDifficulty(q.difficulty)) return false
  if (typeof q.subject !== 'string') return false
  if (typeof q.unit !== 'string') return false
  return true
}

/** 補齊欄位並回傳乾淨的題目 */
export function normalizeQuestion(input: Partial<Question>): Question | null {
  const options = (input.options ?? []).map((o) => String(o ?? '').trim())
  const candidate = {
    id: input.id && String(input.id) ? String(input.id) : newQuestionId(),
    subject: String(input.subject ?? '').trim(),
    unit: String(input.unit ?? '').trim(),
    difficulty: isDifficulty(input.difficulty) ? input.difficulty : 1,
    stem: String(input.stem ?? '').trim(),
    options: options.slice(0, MAX_OPTIONS),
    answerIndex: typeof input.answerIndex === 'number' ? input.answerIndex : 0,
    imageRef: input.imageRef ? String(input.imageRef) : undefined,
    explanation: input.explanation ? String(input.explanation) : undefined,
  }
  return isValidQuestion(candidate) ? (candidate as Question) : null
}

export async function loadQuestionBank(): Promise<Question[]> {
  try {
    const data = await idbGet<unknown>(BANK_KEY)
    if (!Array.isArray(data)) return []
    return data.filter(isValidQuestion)
  } catch (err) {
    console.warn('[questionBank] 讀取失敗', err)
    return []
  }
}

export async function saveQuestionBank(questions: Question[]): Promise<void> {
  await idbSet(BANK_KEY, questions)
}

export async function clearQuestionBank(): Promise<void> {
  await idbDelete(BANK_KEY)
}

/** 內容指紋，用來避免重複匯入同一題 */
export function questionFingerprint(q: Question): string {
  return [q.stem.trim(), ...q.options.map((o) => o.trim()), String(q.answerIndex)].join('|')
}

/** 合併兩份題庫，並去除內容完全相同的重複題 */
export function mergeQuestions(base: Question[], incoming: Question[]): Question[] {
  const seen = new Set(base.map(questionFingerprint))
  const merged = [...base]
  for (const q of incoming) {
    const fp = questionFingerprint(q)
    if (seen.has(fp)) continue
    seen.add(fp)
    merged.push(q)
  }
  return merged
}

export interface BankStats {
  total: number
  byDifficulty: Record<Difficulty, number>
  subjects: string[]
  withImage: number
}

export function bankStats(questions: Question[]): BankStats {
  const byDifficulty: Record<Difficulty, number> = { 1: 0, 2: 0, 3: 0 }
  const subjects = new Set<string>()
  let withImage = 0
  for (const q of questions) {
    byDifficulty[q.difficulty] += 1
    if (q.subject) subjects.add(q.subject)
    if (q.imageRef) withImage += 1
  }
  return {
    total: questions.length,
    byDifficulty,
    subjects: [...subjects].sort((a, b) => a.localeCompare(b, 'zh-Hant')),
    withImage,
  }
}
