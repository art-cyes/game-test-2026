import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PixelButton } from '@/components/PixelButton'
import { PixelPanel } from '@/components/PixelPanel'
import { QuestionEditor } from '@/components/QuestionEditor'
import { DEMO_QUESTIONS } from '@/config/demoQuestions'
import { useQuestionBank } from '@/hooks/useQuestionBank'
import {
  csvTemplate,
  csvToQuestions,
  jsonToQuestions,
  questionsToCsv,
  questionsToJson,
} from '@/lib/game/csvQuestions'
import { newQuestionId } from '@/lib/game/questionBank'
import { downloadText, readTextFile } from '@/lib/download'
import { DIFFICULTY_LABEL, type Difficulty, type Question } from '@/types'

const DIFFICULTY_CLASS: Record<Difficulty, string> = {
  1: 'bg-guard text-night-900',
  2: 'bg-gold text-night-900',
  3: 'bg-hp text-white',
}

const LETTERS = ['A', 'B', 'C', 'D']

interface Notice {
  type: 'ok' | 'err'
  lines: string[]
}

export function TeacherBankPage() {
  const bank = useQuestionBank()
  const [editing, setEditing] = useState<Question | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [filterSubject, setFilterSubject] = useState('')
  const [filterDifficulty, setFilterDifficulty] = useState<'' | Difficulty>('')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)

  const csvInputRef = useRef<HTMLInputElement>(null)
  const jsonInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return bank.questions.filter((q) => {
      if (filterSubject && q.subject !== filterSubject) return false
      if (filterDifficulty && q.difficulty !== filterDifficulty) return false
      if (keyword) {
        const haystack = `${q.stem} ${q.subject} ${q.unit} ${q.options.join(' ')}`.toLowerCase()
        if (!haystack.includes(keyword)) return false
      }
      return true
    })
  }, [bank.questions, filterSubject, filterDifficulty, search])

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const openEdit = (q: Question) => {
    setEditing(q)
    setEditorOpen(true)
  }

  const save = (q: Question) => {
    if (editing) bank.updateQuestion(q)
    else bank.addQuestion(q)
    setEditorOpen(false)
    setEditing(null)
  }

  const remove = (q: Question) => {
    if (!window.confirm(`確定要刪除這題嗎？\n\n${q.stem.slice(0, 40)}`)) return
    bank.removeQuestion(q.id)
  }

  const importCsv = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await readTextFile(file)
      const { questions, errors } = csvToQuestions(text)
      if (questions.length) bank.mergeIn(questions)
      setNotice({
        type: errors.length ? 'err' : 'ok',
        lines: [
          `CSV 匯入完成：新增 ${questions.length} 題。`,
          ...(errors.length ? [`有 ${errors.length} 列被略過：`, ...errors.slice(0, 8)] : []),
        ],
      })
    } catch (err) {
      setNotice({ type: 'err', lines: [`匯入失敗：${(err as Error).message}`] })
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = ''
    }
  }

  const importJson = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await readTextFile(file)
      const { questions, errors } = jsonToQuestions(text)
      if (questions.length) bank.mergeIn(questions)
      setNotice({
        type: errors.length ? 'err' : 'ok',
        lines: [`JSON 匯入完成：新增 ${questions.length} 題。`, ...errors.slice(0, 8)],
      })
    } catch (err) {
      setNotice({ type: 'err', lines: [`匯入失敗：${(err as Error).message}`] })
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = ''
    }
  }

  const loadDemo = () => {
    const demo = DEMO_QUESTIONS.map((q) => ({ ...q, id: newQuestionId() }))
    bank.mergeIn(demo)
    setNotice({ type: 'ok', lines: [`已載入示範題庫（${demo.length} 題）。`] })
  }

  const clearAll = () => {
    if (!window.confirm('確定要清空整個題庫嗎？此動作無法復原。')) return
    void bank.clearAll()
    setNotice({ type: 'ok', lines: ['題庫已清空。'] })
  }

  return (
    <div className="game-surface mx-auto flex min-h-full max-w-5xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-pixel text-sm text-gold">題庫管理</h1>
        <div className="flex items-center gap-4">
          {bank.saving && <span className="font-pixel text-[10px] text-muted">儲存中…</span>}
          <Link to="/teacher" className="font-pixel text-[10px] text-muted hover:text-ink">
            ← 回老師端
          </Link>
        </div>
      </header>

      <PixelPanel title="題庫統計">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="border-[3px] border-black bg-night-700 p-3 text-center">
            <p className="text-xs text-muted">總題數</p>
            <p className="font-pixel mt-1 text-lg text-gold">{bank.stats.total}</p>
          </div>
          {([1, 2, 3] as Difficulty[]).map((d) => (
            <div key={d} className="border-[3px] border-black bg-night-700 p-3 text-center">
              <p className="text-xs text-muted">{DIFFICULTY_LABEL[d]}</p>
              <p className="font-pixel mt-1 text-lg text-ink">{bank.stats.byDifficulty[d]}</p>
            </div>
          ))}
        </div>
        {bank.stats.withImage > 0 && (
          <p className="mt-3 text-[11px] text-muted">其中 {bank.stats.withImage} 題有圖片</p>
        )}
        {!bank.loading && bank.stats.total === 0 && (
          <p className="mt-3 text-sm leading-relaxed text-gold">
            題庫是空的。戰鬥會暫時使用內建示範題（18 題）。
            建議按「載入示範題」先玩看看，或匯入你自己的題庫。
          </p>
        )}
      </PixelPanel>

      <PixelPanel title="題庫操作">
        <div className="flex flex-wrap gap-2">
          <PixelButton size="sm" onClick={openNew}>
            ＋ 新增題目
          </PixelButton>
          <PixelButton variant="secondary" size="sm" onClick={() => csvInputRef.current?.click()}>
            匯入 CSV
          </PixelButton>
          <PixelButton
            variant="secondary"
            size="sm"
            disabled={bank.stats.total === 0}
            onClick={() => {
              downloadText('題庫.csv', questionsToCsv(bank.questions), 'text/csv;charset=utf-8')
              const embedded = bank.questions.filter((q) => q.imageRef?.startsWith('data:')).length
              setNotice({
                type: embedded ? 'err' : 'ok',
                lines: embedded
                  ? [
                      `CSV 已下載，但有 ${embedded} 題的圖片是內嵌資料，會讓檔案變得很大。`,
                      '建議改用「匯出 JSON」備份完整題庫。',
                    ]
                  : [`CSV 已下載（${bank.stats.total} 題）。`],
              })
            }}
          >
            匯出 CSV
          </PixelButton>
          <PixelButton
            variant="secondary"
            size="sm"
            onClick={() =>
              downloadText('題庫範本.csv', csvTemplate(), 'text/csv;charset=utf-8')
            }
          >
            下載範本
          </PixelButton>
          <PixelButton variant="secondary" size="sm" onClick={() => jsonInputRef.current?.click()}>
            匯入 JSON
          </PixelButton>
          <PixelButton
            variant="secondary"
            size="sm"
            disabled={bank.stats.total === 0}
            onClick={() =>
              downloadText('題庫.json', questionsToJson(bank.questions), 'application/json')
            }
          >
            匯出 JSON
          </PixelButton>
          <PixelButton variant="secondary" size="sm" onClick={loadDemo}>
            載入示範題
          </PixelButton>
          <PixelButton
            variant="danger"
            size="sm"
            disabled={bank.stats.total === 0}
            onClick={clearAll}
          >
            清空題庫
          </PixelButton>
        </div>

        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => void importCsv(e.target.files?.[0])}
        />
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void importJson(e.target.files?.[0])}
        />

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          CSV 欄位：科目、單元、難度（簡單／中等／困難）、題目、選項A～D、正解（A～D）、圖片網址、解析。
          可先「下載範本」再照著填。題庫存在這台電腦的瀏覽器裡，建議定期「匯出 JSON」備份。
        </p>
      </PixelPanel>

      {notice && (
        <div
          className={[
            'border-[3px] border-black px-4 py-3 text-sm',
            notice.type === 'ok' ? 'bg-guard text-night-900' : 'bg-hp-dark text-white',
          ].join(' ')}
        >
          {notice.lines.map((line, i) => (
            <p key={i} className={i === 0 ? '' : 'mt-1 text-xs'}>
              {line}
            </p>
          ))}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="font-pixel mt-2 text-[10px] underline"
          >
            關閉
          </button>
        </div>
      )}

      <PixelPanel title={`題目列表（${filtered.length} / ${bank.stats.total}）`}>
        <div className="mb-4 flex flex-wrap gap-3">
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="border-[3px] border-black bg-night-800 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          >
            <option value="">全部科目</option>
            {bank.stats.subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filterDifficulty === '' ? '' : String(filterDifficulty)}
            onChange={(e) =>
              setFilterDifficulty(e.target.value === '' ? '' : (Number(e.target.value) as Difficulty))
            }
            className="border-[3px] border-black bg-night-800 px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          >
            <option value="">全部難度</option>
            <option value="1">簡單</option>
            <option value="2">中等</option>
            <option value="3">困難</option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋題目文字…"
            className="min-w-48 flex-1 border-[3px] border-black bg-night-800 px-3 py-2 text-sm text-ink outline-none placeholder:text-muted/50 focus:border-gold"
          />
        </div>

        {bank.loading ? (
          <p className="py-6 text-center text-sm text-muted">載入中…</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {bank.stats.total === 0 ? '還沒有題目，按「新增題目」開始吧。' : '沒有符合條件的題目。'}
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((q) => (
              <li key={q.id} className="border-[3px] border-black bg-night-700 p-3 pixel-inset">
                <div className="flex flex-wrap items-start gap-3">
                  <span
                    className={`font-pixel shrink-0 border-[3px] border-black px-2 py-1 text-[10px] ${DIFFICULTY_CLASS[q.difficulty]}`}
                  >
                    {DIFFICULTY_LABEL[q.difficulty]}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-muted">
                      {[q.subject, q.unit].filter(Boolean).join(' · ') || '未分類'}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-ink">{q.stem}</p>
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      {q.options.map((opt, i) => (
                        <p
                          key={i}
                          className={`text-xs ${i === q.answerIndex ? 'text-guard' : 'text-muted'}`}
                        >
                          {LETTERS[i]}. {opt}
                          {i === q.answerIndex ? ' ✓' : ''}
                        </p>
                      ))}
                    </div>
                  </div>

                  {q.imageRef && (
                    <img
                      src={q.imageRef}
                      alt=""
                      className="size-16 shrink-0 border-[3px] border-black object-cover"
                    />
                  )}

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(q)}
                      className="font-pixel text-[10px] text-gold hover:underline"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(q)}
                      className="font-pixel text-[10px] text-hp hover:underline"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PixelPanel>

      {editorOpen && (
        <QuestionEditor
          initial={editing}
          onCancel={() => {
            setEditorOpen(false)
            setEditing(null)
          }}
          onSave={save}
        />
      )}
    </div>
  )
}
