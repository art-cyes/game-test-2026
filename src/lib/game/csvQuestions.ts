/**
 * 題庫的 CSV 匯入 / 匯出
 *
 * 匯出時會加上 UTF-8 BOM，讓 Excel 直接開啟不會亂碼。
 * 匯入時對表頭採寬鬆比對，老師用自己習慣的欄位名稱也能讀。
 */

import Papa from 'papaparse'
import { DIFFICULTY_LABEL, type Difficulty, type Question } from '@/types'
import { newQuestionId, normalizeQuestion } from './questionBank'

export const CSV_HEADERS = [
  '科目',
  '單元',
  '難度',
  '題目',
  '選項A',
  '選項B',
  '選項C',
  '選項D',
  '正解',
  '圖片網址',
  '解析',
] as const

/** 各欄位可接受的表頭名稱 */
const HEADER_ALIASES: Record<string, string[]> = {
  subject: ['科目', '科別', '領域'],
  unit: ['單元', '主題', '章節'],
  difficulty: ['難度', '難易度', '等級'],
  stem: ['題目', '題幹', '問題', '題'],
  optionA: ['選項A', '選項1', 'A', '選項一'],
  optionB: ['選項B', '選項2', 'B', '選項二'],
  optionC: ['選項C', '選項3', 'C', '選項三'],
  optionD: ['選項D', '選項4', 'D', '選項四'],
  answer: ['正解', '答案', '正確答案', '正解選項'],
  image: ['圖片網址', '圖片', '圖'],
  explanation: ['解析', '說明', '詳解'],
}

function pick(row: Record<string, string>, field: keyof typeof HEADER_ALIASES): string {
  for (const name of HEADER_ALIASES[field]) {
    const hit = Object.keys(row).find((k) => k.trim() === name)
    if (hit !== undefined && row[hit] !== undefined && String(row[hit]).trim() !== '') {
      return String(row[hit]).trim()
    }
  }
  return ''
}

export function parseDifficulty(text: string): Difficulty {
  const t = text.trim().toLowerCase()
  if (['1', '簡單', '易', '低', 'easy'].includes(t)) return 1
  if (['3', '困難', '難', '高', 'hard'].includes(t)) return 3
  if (['2', '中等', '中', '普通', 'normal', 'medium'].includes(t)) return 2
  return 1
}

export function parseAnswerIndex(text: string): number | null {
  const t = text.trim().toUpperCase()
  if (['A', '1', '一'].includes(t)) return 0
  if (['B', '2', '二'].includes(t)) return 1
  if (['C', '3', '三'].includes(t)) return 2
  if (['D', '4', '四'].includes(t)) return 3
  return null
}

export function answerIndexToLetter(index: number): string {
  return ['A', 'B', 'C', 'D'][index] ?? 'A'
}

/* ------------------------------------------------------------------ */
/* 匯出                                                                */
/* ------------------------------------------------------------------ */

export function questionsToCsv(questions: Question[]): string {
  const rows = questions.map((q) => ({
    科目: q.subject,
    單元: q.unit,
    難度: DIFFICULTY_LABEL[q.difficulty],
    題目: q.stem,
    選項A: q.options[0],
    選項B: q.options[1],
    選項C: q.options[2],
    選項D: q.options[3],
    正解: answerIndexToLetter(q.answerIndex),
    圖片網址: q.imageRef ?? '',
    解析: q.explanation ?? '',
  }))
  const csv = Papa.unparse(rows, { columns: [...CSV_HEADERS] })
  // Excel 需要 BOM 才不會把中文變亂碼
  return `\uFEFF${csv}`
}

export function csvTemplate(): string {
  const rows = [
    {
      科目: '數學',
      單元: '整數四則',
      難度: '簡單',
      題目: '7 + 8 = ?',
      選項A: '13',
      選項B: '15',
      選項C: '16',
      選項D: '17',
      正解: 'B',
      圖片網址: '',
      解析: '7 + 8 = 15',
    },
    {
      科目: '自然',
      單元: '植物',
      難度: '中等',
      題目: '植物行光合作用時，會吸收哪一種氣體？',
      選項A: '氧氣',
      選項B: '氮氣',
      選項C: '二氧化碳',
      選項D: '氫氣',
      正解: 'C',
      圖片網址: 'https://example.com/leaf.png',
      解析: '',
    },
  ]
  return `\uFEFF${Papa.unparse(rows, { columns: [...CSV_HEADERS] })}`
}

/* ------------------------------------------------------------------ */
/* 匯入                                                                */
/* ------------------------------------------------------------------ */

export interface CsvImportResult {
  questions: Question[]
  errors: string[]
}

export function csvToQuestions(csvText: string): CsvImportResult {
  const text = csvText.replace(/^\uFEFF/, '')
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })

  const errors: string[] = []
  const questions: Question[] = []

  if (!parsed.data.length) {
    return { questions, errors: ['CSV 裡沒有資料列。'] }
  }

  parsed.data.forEach((row, i) => {
    const lineNo = i + 2 // 含表頭
    const stem = pick(row, 'stem')
    if (!stem) return // 空白列直接略過

    const options = [
      pick(row, 'optionA'),
      pick(row, 'optionB'),
      pick(row, 'optionC'),
      pick(row, 'optionD'),
    ]
    if (options.some((o) => !o)) {
      errors.push(`第 ${lineNo} 列：四個選項必須都填。`)
      return
    }

    const answerIndex = parseAnswerIndex(pick(row, 'answer'))
    if (answerIndex === null) {
      errors.push(`第 ${lineNo} 列：正解必須是 A、B、C 或 D。`)
      return
    }

    const q = normalizeQuestion({
      id: newQuestionId(),
      subject: pick(row, 'subject'),
      unit: pick(row, 'unit'),
      difficulty: parseDifficulty(pick(row, 'difficulty')),
      stem,
      options: options as [string, string, string, string],
      answerIndex,
      imageRef: pick(row, 'image') || undefined,
      explanation: pick(row, 'explanation') || undefined,
    })

    if (!q) {
      errors.push(`第 ${lineNo} 列：題目格式不完整。`)
      return
    }
    questions.push(q)
  })

  return { questions, errors }
}

/* ------------------------------------------------------------------ */
/* JSON 備份                                                           */
/* ------------------------------------------------------------------ */

export interface JsonBankFile {
  version: 1
  exportedAt: string
  questions: Question[]
}

export function questionsToJson(questions: Question[]): string {
  const payload: JsonBankFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    questions,
  }
  return JSON.stringify(payload, null, 2)
}

export function jsonToQuestions(jsonText: string): CsvImportResult {
  const errors: string[] = []
  try {
    const data = JSON.parse(jsonText) as unknown
    const rawList = Array.isArray(data)
      ? data
      : ((data as JsonBankFile | undefined)?.questions ?? [])
    if (!Array.isArray(rawList)) {
      return { questions: [], errors: ['JSON 格式不正確：找不到 questions 陣列。'] }
    }
    const questions: Question[] = []
    rawList.forEach((raw, i) => {
      const q = normalizeQuestion({ ...(raw as Partial<Question>), id: newQuestionId() })
      if (q) questions.push(q)
      else errors.push(`第 ${i + 1} 筆題目格式不完整，已略過。`)
    })
    return { questions, errors }
  } catch (err) {
    return { questions: [], errors: [`JSON 解析失敗：${(err as Error).message}`] }
  }
}
