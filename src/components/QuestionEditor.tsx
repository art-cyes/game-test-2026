import { useRef, useState } from 'react'
import { PixelButton } from '@/components/PixelButton'
import { newQuestionId, normalizeQuestion } from '@/lib/game/questionBank'
import { dataUrlBytes, fileToCompressedDataUrl, formatBytes } from '@/lib/storage/imageCompress'
import { DIFFICULTY_LABEL, type Difficulty, type Question } from '@/types'

interface Props {
  /** null 表示新增 */
  initial: Question | null
  onCancel: () => void
  onSave: (q: Question) => void
}

const LETTERS = ['A', 'B', 'C', 'D']
const DIFFICULTIES: Difficulty[] = [1, 2, 3]

export function QuestionEditor({ initial, onCancel, onSave }: Props) {
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 1)
  const [stem, setStem] = useState(initial?.stem ?? '')
  const [options, setOptions] = useState<string[]>(
    initial?.options ? [...initial.options] : ['', '', '', ''],
  )
  const [answerIndex, setAnswerIndex] = useState(initial?.answerIndex ?? 0)
  const [imageRef, setImageRef] = useState(initial?.imageRef ?? '')
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [error, setError] = useState('')
  const [imageBusy, setImageBusy] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  const setOption = (i: number, value: string) => {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)))
  }

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('請選擇圖片檔案。')
      return
    }
    setImageBusy(true)
    setError('')
    try {
      const dataUrl = await fileToCompressedDataUrl(file)
      setImageRef(dataUrl)
    } catch (err) {
      setError(`圖片處理失敗：${(err as Error).message}`)
    } finally {
      setImageBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const submit = () => {
    const q = normalizeQuestion({
      id: initial?.id ?? newQuestionId(),
      subject,
      unit,
      difficulty,
      stem,
      options: options as [string, string, string, string],
      answerIndex,
      imageRef: imageRef.trim() || undefined,
      explanation: explanation.trim() || undefined,
    })
    if (!q) {
      setError('請確認：題目、四個選項都必須填寫。')
      return
    }
    onSave(q)
  }

  const imageIsDataUrl = imageRef.startsWith('data:')

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-night-900/90 px-3 py-6">
      <div className="w-full max-w-2xl border-[3px] border-black bg-panel pixel-frame">
        <header className="flex items-center justify-between border-b-[3px] border-black bg-night-600 px-4 py-2.5">
          <h2 className="font-pixel text-[11px] text-gold">
            {initial ? '編輯題目' : '新增題目'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="font-pixel text-[10px] text-muted hover:text-ink"
          >
            ✕ 關閉
          </button>
        </header>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">科目</span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="例如 數學"
                className="w-full border-[3px] border-black bg-night-800 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted/50 focus:border-gold"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">單元</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="例如 整數四則"
                className="w-full border-[3px] border-black bg-night-800 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted/50 focus:border-gold"
              />
            </label>
          </div>

          <div>
            <span className="mb-2 block text-xs text-muted">難度</span>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={[
                    'font-pixel border-[3px] border-black px-4 py-2 text-[10px] transition',
                    difficulty === d ? 'bg-gold text-night-900' : 'bg-night-700 text-muted hover:text-ink',
                  ].join(' ')}
                >
                  {DIFFICULTY_LABEL[d]}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">題目</span>
            <textarea
              value={stem}
              onChange={(e) => setStem(e.target.value)}
              rows={3}
              placeholder="輸入題目文字"
              className="w-full border-[3px] border-black bg-night-800 px-3 py-2.5 text-sm leading-relaxed text-ink outline-none placeholder:text-muted/50 focus:border-gold"
            />
          </label>

          <div>
            <span className="mb-2 block text-xs text-muted">
              選項（點左邊圓點設定正解）
            </span>
            <div className="space-y-2">
              {options.map((opt, i) => {
                const correct = answerIndex === i
                return (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAnswerIndex(i)}
                      aria-label={`設為正解 ${LETTERS[i]}`}
                      className={[
                        'font-pixel flex size-9 shrink-0 items-center justify-center border-[3px] border-black text-xs transition',
                        correct ? 'bg-guard text-night-900' : 'bg-night-700 text-muted',
                      ].join(' ')}
                    >
                      {LETTERS[i]}
                    </button>
                    <input
                      value={opt}
                      onChange={(e) => setOption(i, e.target.value)}
                      placeholder={`選項 ${LETTERS[i]}`}
                      className={[
                        'flex-1 border-[3px] border-black bg-night-800 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted/50 focus:border-gold',
                        correct ? 'border-guard' : '',
                      ].join(' ')}
                    />
                    {correct && (
                      <span className="font-pixel shrink-0 text-[9px] text-guard">正解</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-xs text-muted">題目圖片（選填）</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void pickImage(e.target.files?.[0])}
              />
              <PixelButton
                variant="secondary"
                size="sm"
                disabled={imageBusy}
                onClick={() => fileRef.current?.click()}
              >
                {imageBusy ? '處理中…' : '上傳圖片'}
              </PixelButton>
              <input
                value={imageIsDataUrl ? '' : imageRef}
                onChange={(e) => setImageRef(e.target.value)}
                placeholder="或貼上圖片網址 https://…"
                className="min-w-48 flex-1 border-[3px] border-black bg-night-800 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted/50 focus:border-gold"
              />
              {imageRef && (
                <PixelButton variant="danger" size="sm" onClick={() => setImageRef('')}>
                  移除圖片
                </PixelButton>
              )}
            </div>
            {imageRef && (
              <div className="mt-3">
                <img
                  src={imageRef}
                  alt="題目圖片預覽"
                  className="max-h-48 border-[3px] border-black object-contain"
                />
                {imageIsDataUrl && (
                  <p className="mt-1.5 text-[11px] text-muted">
                    已壓縮：{formatBytes(dataUrlBytes(imageRef))}
                  </p>
                )}
              </div>
            )}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">解析（選填）</span>
            <input
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="例如 7 + 8 = 15"
              className="w-full border-[3px] border-black bg-night-800 px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted/50 focus:border-gold"
            />
          </label>

          {error && (
            <p className="border-[3px] border-black bg-hp-dark px-3 py-2.5 text-sm text-white">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <PixelButton size="lg" className="flex-1" onClick={submit}>
              儲存題目
            </PixelButton>
            <PixelButton variant="secondary" size="lg" onClick={onCancel}>
              取消
            </PixelButton>
          </div>
        </div>
      </div>
    </div>
  )
}
