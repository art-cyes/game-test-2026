import { PixelButton } from '@/components/PixelButton'
import type { BattleState } from '@/lib/game/battle'
import { resultFileName, resultsToCsv, type BattleOutcome } from '@/lib/game/results'
import { downloadText } from '@/lib/download'
import { ROLE_LABEL, type BossDifficulty } from '@/types'

interface Props {
  className: string
  bossDifficulty: BossDifficulty
  outcome: BattleOutcome
  battle: BattleState | null
  onBackToLobby?: () => void
  /** 學生端：標記自己的那一列 */
  highlightSeatNo?: string
  /** 學生端：精簡版（只看自己與前幾名） */
  compact?: boolean
}

function formatDateTime(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function ResultScreen({
  className,
  bossDifficulty,
  outcome,
  battle,
  onBackToLobby,
  highlightSeatNo,
  compact = false,
}: Props) {
  const win = outcome.result === 'win'
  const rows = compact ? outcome.results.slice(0, 5) : outcome.results
  const mine = highlightSeatNo
    ? outcome.results.find((r) => r.seatNo === highlightSeatNo)
    : undefined
  const myAwards = mine ? outcome.awards.filter((a) => a.seatNo === mine.seatNo) : []
  const myRank = mine ? outcome.results.findIndex((r) => r.seatNo === mine.seatNo) + 1 : 0

  const download = () => {
    downloadText(
      resultFileName(className, bossDifficulty, outcome.endedAt),
      resultsToCsv(outcome.results, outcome.awards),
      'text/csv;charset=utf-8',
    )
  }

  return (
    <div className="game-surface mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 px-4 py-6">
      {/* 標題 */}
      <div className="text-center">
        <p className={`font-pixel text-3xl ${win ? 'text-gold' : 'text-hp'}`}>
          {win ? 'VICTORY!' : 'DEFEAT…'}
        </p>
        <p className="mt-3 text-sm text-ink">
          {win ? '勇者們成功打倒了魔王！' : '這次沒能打倒魔王，下次再挑戰！'}
        </p>
        <p className="mt-2 text-[11px] text-muted">
          {className}　·　{formatDateTime(outcome.endedAt)}
        </p>
      </div>

      {/* 摘要 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border-[3px] border-black bg-night-700 py-3 text-center">
          <p className="text-xs text-muted">全隊答對</p>
          <p className="font-pixel mt-1 text-lg text-guard">{battle?.totalCorrect ?? '—'}</p>
        </div>
        <div className="border-[3px] border-black bg-night-700 py-3 text-center">
          <p className="text-xs text-muted">全隊答錯</p>
          <p className="font-pixel mt-1 text-lg text-hp">{battle?.totalWrong ?? '—'}</p>
        </div>
        <div className="border-[3px] border-black bg-night-700 py-3 text-center">
          <p className="text-xs text-muted">剩餘時間</p>
          <p className="font-pixel mt-1 text-lg text-ink">{battle?.remainingSec ?? '—'}s</p>
        </div>
        <div className="border-[3px] border-black bg-night-700 py-3 text-center">
          <p className="text-xs text-muted">參戰人數</p>
          <p className="font-pixel mt-1 text-lg text-gold">{outcome.results.length}</p>
        </div>
      </div>

      {/* 我的成績（學生端） */}
      {compact && mine && (
        <div className="border-[3px] border-black bg-panel p-4 pixel-frame">
          <h3 className="font-pixel mb-3 text-[11px] text-gold">我的成績</h3>
          <p className="text-sm text-ink">
            第 <span className="font-pixel text-gold">{myRank}</span> 名　·　座號{' '}
            {mine.seatNo}　{mine.name}　·　{ROLE_LABEL[mine.role]}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="border-[3px] border-black bg-night-700 px-3 py-2">
              <dt className="text-muted">答對</dt>
              <dd className="font-pixel mt-0.5 text-guard">{mine.correct}</dd>
            </div>
            <div className="border-[3px] border-black bg-night-700 px-3 py-2">
              <dt className="text-muted">答錯</dt>
              <dd className="font-pixel mt-0.5 text-hp">{mine.wrong}</dd>
            </div>
            <div className="border-[3px] border-black bg-night-700 px-3 py-2">
              <dt className="text-muted">正確率</dt>
              <dd className="font-pixel mt-0.5 text-ink">
                {Math.round(mine.accuracy * 100)}%
              </dd>
            </div>
            <div className="border-[3px] border-black bg-night-700 px-3 py-2">
              <dt className="text-muted">總傷害</dt>
              <dd className="font-pixel mt-0.5 text-gold">{mine.damage}</dd>
            </div>
          </dl>
          {myAwards.length > 0 && (
            <p className="mt-3 text-sm text-gold">
              {myAwards.map((a) => `${a.emoji} ${a.title}`).join('　')}
            </p>
          )}
        </div>
      )}

      {/* 獎項 */}
      <div className="border-[3px] border-black bg-panel p-4 pixel-frame">
        <h3 className="font-pixel mb-3 text-[11px] text-gold">🏅 獎項</h3>
        {outcome.awards.length === 0 ? (
          <p className="text-xs text-muted">這場沒有產生獎項。</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {outcome.awards.map((a) => (
              <div
                key={a.id}
                className={[
                  'border-[3px] border-black px-3 py-3',
                  a.id === 'mvp' ? 'bg-gold text-night-900' : 'bg-night-700 text-ink',
                ].join(' ')}
              >
                <p className="font-pixel text-[10px]">
                  {a.emoji} {a.title}
                </p>
                <p className="mt-2 text-sm">
                  {a.seatNo} {a.name}
                </p>
                <p
                  className={`mt-1 text-[11px] ${a.id === 'mvp' ? 'text-night-800' : 'text-muted'}`}
                >
                  {a.detail}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 排行榜 */}
      <div className="border-[3px] border-black bg-panel p-4 pixel-frame">
        <h3 className="font-pixel mb-3 text-[11px] text-gold">
          ⚔ 傷害排行榜{compact ? '（前 5 名）' : `（${outcome.results.length} 人）`}
        </h3>
        {outcome.results.length === 0 ? (
          <p className="text-xs text-muted">沒有作答紀錄。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-muted">
                  <th className="pb-2 font-normal">名次</th>
                  <th className="pb-2 font-normal">座號</th>
                  <th className="pb-2 font-normal">姓名</th>
                  <th className="pb-2 font-normal">角色</th>
                  <th className="pb-2 text-right font-normal">傷害</th>
                  <th className="pb-2 text-right font-normal">對／錯</th>
                  <th className="pb-2 text-right font-normal">正確率</th>
                  <th className="pb-2 text-right font-normal">平均秒數</th>
                  <th className="pb-2 text-right font-normal">連擊</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isMe = r.seatNo === highlightSeatNo
                  return (
                    <tr
                      key={r.seatNo}
                      className={[
                        'border-t-[3px] border-black/60',
                        isMe ? 'bg-gold text-night-900' : '',
                      ].join(' ')}
                    >
                      <td className="py-2 font-pixel text-xs">{i + 1}</td>
                      <td className="py-2 font-pixel text-xs">{r.seatNo}</td>
                      <td className="py-2">{r.name}</td>
                      <td className={`py-2 text-xs ${isMe ? '' : 'text-muted'}`}>
                        {ROLE_LABEL[r.role]}
                      </td>
                      <td className="py-2 text-right font-pixel text-xs">{r.damage}</td>
                      <td className="py-2 text-right text-xs">
                        <span className={isMe ? '' : 'text-guard'}>{r.correct}</span>
                        <span className={isMe ? '' : 'text-muted'}> / </span>
                        <span className={isMe ? '' : 'text-hp'}>{r.wrong}</span>
                      </td>
                      <td className="py-2 text-right font-pixel text-xs">
                        {Math.round(r.accuracy * 100)}%
                      </td>
                      <td className="py-2 text-right font-pixel text-xs">
                        {r.avgSeconds.toFixed(1)}
                      </td>
                      <td className="py-2 text-right font-pixel text-xs">x{r.maxCombo}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 動作 */}
      {!compact && (
        <div className="flex flex-wrap gap-3">
          <PixelButton size="lg" className="flex-1" onClick={download}>
            ⬇ 下載 CSV 報表
          </PixelButton>
          {onBackToLobby && (
            <PixelButton variant="secondary" size="lg" onClick={onBackToLobby}>
              返回大廳
            </PixelButton>
          )}
        </div>
      )}

      {compact && (
        <p className="text-center text-xs text-muted">老師會下載完整的答題報表給大家。</p>
      )}
    </div>
  )
}
