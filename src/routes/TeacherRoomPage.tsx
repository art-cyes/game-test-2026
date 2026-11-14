import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PixelButton } from '@/components/PixelButton'
import { PixelPanel } from '@/components/PixelPanel'
import { QRCodeCard } from '@/components/QRCodeCard'
import { RealtimeDownNotice } from '@/components/RealtimeDownNotice'
import { DEMO_QUESTIONS } from '@/config/demoQuestions'
import { useHostBattle } from '@/hooks/useHostBattle'
import { useHostLobby } from '@/hooks/useHostLobby'
import { useQuestionBank } from '@/hooks/useQuestionBank'
import { unlockAudio } from '@/lib/audio'
import { loadGameSetup } from '@/lib/game/gameStore'
import { getJoinUrl } from '@/lib/game/urls'
import { BOSS_DIFFICULTY_LABEL, ROLE_LABEL } from '@/types'
import { BossBattleScreen } from './BossBattleScreen'
import { ResultScreen } from './ResultScreen'

function statusOf(p: { online: boolean; away: boolean }) {
  if (!p.online) return { dot: '⚫', label: '離線', className: 'text-muted' }
  if (p.away) return { dot: '🟡', label: '不在分頁', className: 'text-gold' }
  return { dot: '🟢', label: '在線', className: 'text-guard' }
}

export function TeacherRoomPage() {
  const { roomCode = '' } = useParams<{ roomCode: string }>()
  const setup = useMemo(() => loadGameSetup(roomCode), [roomCode])
  const join = useMemo(() => getJoinUrl(roomCode), [roomCode])

  const lobby = useHostLobby({
    roomCode: setup ? roomCode : null,
    settings: setup?.settings ?? null,
  })

  const bank = useQuestionBank()
  const usingDemo = !bank.loading && bank.questions.length === 0
  const questionPool = usingDemo ? DEMO_QUESTIONS : bank.questions

  const battleHook = useHostBattle({
    adapter: lobby.adapter,
    status: lobby.status,
    settings: setup?.settings ?? null,
    players: lobby.onlinePlayers,
    phase: lobby.phase,
    questionPool,
    onFinish: () => lobby.setPhaseExternal('result'),
  })

  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(join.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* 某些瀏覽器不允許，忽略 */
    }
  }

  if (!setup) {
    return (
      <div className="game-surface mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-5 px-4 text-center">
        <p className="font-pixel text-sm text-hp">找不到房間 {roomCode}</p>
        <p className="text-sm text-muted">這個房間的設定不存在，可能已經被清除。</p>
        <Link to="/teacher/new">
          <PixelButton>開新遊戲</PixelButton>
        </Link>
      </div>
    )
  }

  const { settings } = setup
  const bossLabel = BOSS_DIFFICULTY_LABEL[settings.bossDifficulty]

  /* ---------------- 結算 ---------------- */
  if (battleHook.outcome) {
    return (
      <ResultScreen
        className={settings.className}
        bossDifficulty={settings.bossDifficulty}
        outcome={battleHook.outcome}
        battle={battleHook.battle}
        onBackToLobby={lobby.backToLobby}
      />
    )
  }

  /* ---------------- 戰鬥中：投影主畫面 ---------------- */
  if (lobby.phase !== 'lobby' && battleHook.battle) {
    return (
      <BossBattleScreen
        className={settings.className}
        bossDifficulty={settings.bossDifficulty}
        battle={battleHook.battle}
        stats={battleHook.stats}
        players={lobby.players}
        events={battleHook.events}
        maxPlayers={settings.maxPlayers}
        questionCount={questionPool.length}
        usingDemoQuestions={usingDemo}
        onUseDefense={battleHook.castDefense}
        onUseUlt={battleHook.castUlt}
        onEndBattle={battleHook.endBattle}
      />
    )
  }

  /* ---------------- 大廳 ---------------- */
  const offlineCount = lobby.players.length - lobby.onlineCount

  return (
    <div className="game-surface mx-auto flex min-h-full max-w-5xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-pixel text-sm text-gold">{settings.className}</h1>
          <p className="mt-1.5 text-xs text-muted">
            魔王難度：{bossLabel}　·　時間：{settings.durationSec / 60} 分鐘　·　人數上限{' '}
            {settings.maxPlayers} 人　·　題庫{' '}
            <span className={usingDemo ? 'text-gold' : 'text-ink'}>
              {questionPool.length} 題{usingDemo ? '（示範題）' : ''}
            </span>
          </p>
        </div>
        <Link to="/teacher" className="font-pixel text-[10px] text-muted hover:text-ink">
          ← 回老師端
        </Link>
      </header>

      {lobby.status === 'error' && (
        <RealtimeDownNotice mode={lobby.adapter.mode === 'supabase' ? 'supabase' : 'cloudflare'} />
      )}

      <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
        <PixelPanel title="學生掃這個 QR Code 加入">
          <div className="flex flex-col items-center gap-4">
            <QRCodeCard value={join.url} size={240} />
            <div className="text-center">
              <p className="text-[11px] text-muted">房間代碼</p>
              <p className="font-pixel mt-1 text-2xl tracking-[0.3em] text-gold">{roomCode}</p>
            </div>
            <div className="w-full">
              <p className="mb-1.5 break-all text-[11px] leading-relaxed text-muted">{join.url}</p>
              <PixelButton variant="secondary" size="sm" className="w-full" onClick={copyLink}>
                {copied ? '✓ 已複製連結' : '複製連結'}
              </PixelButton>
            </div>
            {join.isLocalOnly && (
              <p className="w-full border-[3px] border-black bg-hp-dark px-3 py-2 text-[11px] leading-relaxed text-white">
                ⚠ 目前的網址是 localhost，學生手機連不到。請改用區網 IP，或部署到網路上（見 README）。
              </p>
            )}
          </div>
        </PixelPanel>

        <div className="flex flex-col gap-5">
          <PixelPanel
            title={`勇者名單（${lobby.onlineCount} 在線${
              lobby.awayCount ? ` · ${lobby.awayCount} 不在分頁` : ''
            }${offlineCount ? ` · ${offlineCount} 離線` : ''}）`}
            action={
              <span
                className={[
                  'font-pixel text-[10px]',
                  lobby.status === 'error'
                    ? 'text-hp'
                    : lobby.status === 'connected'
                      ? 'text-guard'
                      : 'text-muted',
                ].join(' ')}
              >
                {lobby.status === 'connected'
                  ? '已連線'
                  : lobby.status === 'connecting'
                    ? '連線中…'
                    : lobby.status === 'error'
                      ? '連線錯誤'
                      : '離線'}
              </span>
            }
          >
            {lobby.players.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                還沒有人加入…請學生掃 QR Code，並在畫面上輸入座號與姓名。
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-muted">
                      <th className="pb-2 font-normal">座號</th>
                      <th className="pb-2 font-normal">姓名</th>
                      <th className="pb-2 font-normal">角色</th>
                      <th className="pb-2 font-normal">狀態</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lobby.players.map((p) => {
                      const st = statusOf(p)
                      return (
                        <tr key={p.seatNo} className="border-t-[3px] border-black/60">
                          <td className="py-2.5 font-pixel text-xs text-ink">{p.seatNo}</td>
                          <td className="py-2.5 text-ink">{p.name}</td>
                          <td className="py-2.5 text-muted">{ROLE_LABEL[p.role]}</td>
                          <td className={`py-2.5 text-xs ${st.className}`}>
                            {st.dot} {st.label}
                          </td>
                          <td className="py-2.5 text-right">
                            {p.online && (
                              <button
                                type="button"
                                onClick={() => lobby.kick(p.clientId)}
                                className="font-pixel text-[10px] text-hp hover:underline"
                              >
                                踢除
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PixelPanel>

          <PixelPanel title="開始遊戲">
            {(usingDemo || questionPool.length < 10) && (
              <p className="mb-4 border-[3px] border-black bg-gold px-3 py-2.5 text-xs leading-relaxed text-night-900">
                {usingDemo
                  ? `目前使用內建示範題（${DEMO_QUESTIONS.length} 題）。建議先到「題庫管理」建立或匯入你自己的題目。`
                  : `題庫只有 ${questionPool.length} 題，遊戲中容易重複出題，建議再多加一些。`}{' '}
                <Link to="/teacher/bank" className="underline">
                  前往題庫管理
                </Link>
              </p>
            )}
            <p className="mb-4 text-sm leading-relaxed text-muted">
              確認名單都沒問題後就可以開始。遊戲進行中請勿關閉這個頁面（老師端就是遊戲主機），
              魔王戰場會顯示在這個畫面上，投影給全班看。
            </p>
            <PixelButton
              size="xl"
              className="w-full"
              disabled={lobby.onlineCount === 0}
              onClick={() => {
                unlockAudio()
                lobby.startGame()
              }}
            >
              {lobby.onlineCount === 0
                ? '等待學生加入…'
                : `開始遊戲（${lobby.onlineCount} 位勇者）`}
            </PixelButton>
          </PixelPanel>
        </div>
      </div>
    </div>
  )
}
