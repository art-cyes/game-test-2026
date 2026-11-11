import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PixelPanel } from '@/components/PixelPanel'
import { PixelButton } from '@/components/PixelButton'
import { BOSS_PRESETS } from '@/config/gameDefaults'
import { useQuestionBank } from '@/hooks/useQuestionBank'
import { DEMO_QUESTIONS } from '@/config/demoQuestions'
import { downloadText } from '@/lib/download'
import { clearHistory, loadHistory, removeGameRecord } from '@/lib/game/history'
import { computeAwards, resultFileName, resultsToCsv } from '@/lib/game/results'
import { BOSS_DIFFICULTY_LABEL, type GameRecord } from '@/types'

function formatDateTime(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function TeacherHomePage() {
  const bank = useQuestionBank()
  const questionCount = bank.stats.total
  const usingDemo = !bank.loading && questionCount === 0
  const [history, setHistory] = useState<GameRecord[]>(() => loadHistory())

  const downloadRecord = (record: GameRecord) => {
    downloadText(
      resultFileName(record.className, record.bossDifficulty, record.endTime),
      resultsToCsv(record.students, computeAwards(record.students)),
      'text/csv;charset=utf-8',
    )
  }

  const removeRecord = (id: string) => {
    removeGameRecord(id)
    setHistory(loadHistory())
  }

  const clearAll = () => {
    if (!window.confirm('確定要清空所有歷史紀錄嗎？')) return
    clearHistory()
    setHistory([])
  }

  return (
    <div className="game-surface mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-pixel text-sm text-gold sm:text-base">老師控制台</h1>
        <Link to="/" className="font-pixel text-[10px] text-muted hover:text-ink">
          ← 回首頁
        </Link>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <PixelPanel title="開新遊戲">
          <p className="mb-4 text-sm leading-relaxed text-muted">
            設定班級、魔王難度與人數，立刻產生 QR Code 讓學生加入。
          </p>
          <Link to="/teacher/new">
            <PixelButton size="lg" className="w-full">
              開新遊戲
            </PixelButton>
          </Link>
        </PixelPanel>

        <PixelPanel title="題庫管理">
          <p className="mb-4 text-sm leading-relaxed text-muted">
            {bank.loading
              ? '讀取題庫中…'
              : usingDemo
                ? `尚未建立題庫，戰鬥會先使用內建示範題（${DEMO_QUESTIONS.length} 題）。可匯入 CSV 或直接新增題目。`
                : `目前有 ${questionCount} 題（簡單 ${bank.stats.byDifficulty[1]}、中等 ${bank.stats.byDifficulty[2]}、困難 ${bank.stats.byDifficulty[3]}）。`}
          </p>
          <Link to="/teacher/bank">
            <PixelButton size="lg" variant="secondary" className="w-full">
              管理題庫
            </PixelButton>
          </Link>
        </PixelPanel>
      </div>

      <PixelPanel title="魔王難度預覽（三選一）">
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.values(BOSS_PRESETS).map((boss) => (
            <div
              key={boss.difficulty}
              className="border-[3px] border-black bg-night-700 p-4 pixel-inset"
            >
              <p className="font-pixel text-[11px] text-gold">
                {BOSS_DIFFICULTY_LABEL[boss.difficulty]}
              </p>
              <p className="mt-2 text-sm text-ink">{boss.name}</p>
              <dl className="mt-3 space-y-1 text-xs text-muted">
                <div className="flex justify-between">
                  <dt>時間</dt>
                  <dd className="font-pixel">{boss.durationSec / 60} 分</dd>
                </div>
                <div className="flex justify-between">
                  <dt>魔王 HP</dt>
                  <dd className="font-pixel">{boss.bossHp.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>攻擊間隔</dt>
                  <dd className="font-pixel">{boss.attackIntervalSec}s</dd>
                </div>
                <div className="flex justify-between">
                  <dt>攻擊力</dt>
                  <dd className="font-pixel">{boss.attackPower}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted">＊數值為初值，M4 會依實測調整。</p>
      </PixelPanel>

      <PixelPanel
        title={`歷史紀錄（${history.length} 場）`}
        action={
          history.length > 0 ? (
            <button
              type="button"
              onClick={clearAll}
              className="font-pixel text-[10px] text-hp hover:underline"
            >
              清空
            </button>
          ) : undefined
        }
      >
        {history.length === 0 ? (
          <p className="text-sm text-muted">
            還沒有紀錄。玩完一場後，這裡會保留成績並可下載 CSV 報表。
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 border-[3px] border-black bg-night-700 px-3 py-2.5 pixel-inset"
              >
                <span
                  className={`font-pixel border-[3px] border-black px-2 py-1 text-[10px] ${
                    r.result === 'win' ? 'bg-gold text-night-900' : 'bg-hp text-white'
                  }`}
                >
                  {r.result === 'win' ? '勝' : '敗'}
                </span>
                <span className="text-sm text-ink">{r.className}</span>
                <span className="text-[11px] text-muted">
                  {BOSS_DIFFICULTY_LABEL[r.bossDifficulty]}　·　{r.students.length} 人　·　
                  {formatDateTime(r.endTime)}
                </span>
                <span className="ml-auto flex gap-3">
                  <button
                    type="button"
                    onClick={() => downloadRecord(r)}
                    className="font-pixel text-[10px] text-gold hover:underline"
                  >
                    下載 CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRecord(r.id)}
                    className="font-pixel text-[10px] text-hp hover:underline"
                  >
                    刪除
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </PixelPanel>

      <footer className="flex flex-wrap items-center gap-3">
        <Link to="/dev/realtime" className="font-pixel text-[10px] text-muted hover:text-ink">
          即時連線測試 →
        </Link>
      </footer>
    </div>
  )
}
