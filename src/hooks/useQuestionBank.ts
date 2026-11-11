import { useCallback, useEffect, useState } from 'react'
import {
  bankStats,
  clearQuestionBank,
  loadQuestionBank,
  mergeQuestions,
  saveQuestionBank,
} from '@/lib/game/questionBank'
import type { Question } from '@/types'

export function useQuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadQuestionBank()
      .then((list) => {
        if (!cancelled) setQuestions(list)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(async (next: Question[]) => {
    setQuestions(next)
    setSaving(true)
    try {
      await saveQuestionBank(next)
    } catch (err) {
      console.warn('[useQuestionBank] 儲存失敗', err)
    } finally {
      setSaving(false)
    }
  }, [])

  const addQuestion = useCallback(
    (q: Question) => persist([q, ...questions]),
    [persist, questions],
  )

  const updateQuestion = useCallback(
    (q: Question) => persist(questions.map((old) => (old.id === q.id ? q : old))),
    [persist, questions],
  )

  const removeQuestion = useCallback(
    (id: string) => persist(questions.filter((q) => q.id !== id)),
    [persist, questions],
  )

  const replaceAll = useCallback((list: Question[]) => persist(list), [persist])

  const mergeIn = useCallback(
    (incoming: Question[]) => persist(mergeQuestions(questions, incoming)),
    [persist, questions],
  )

  const clearAll = useCallback(async () => {
    setQuestions([])
    await clearQuestionBank()
  }, [])

  return {
    questions,
    loading,
    saving,
    stats: bankStats(questions),
    addQuestion,
    updateQuestion,
    removeQuestion,
    replaceAll,
    mergeIn,
    clearAll,
  }
}
