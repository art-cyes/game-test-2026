import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PixelButton } from '@/components/PixelButton'
import { PixelPanel } from '@/components/PixelPanel'
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom'
import type { ConnectionStatus, PresenceMeta } from '@/lib/realtime'
import { ROLE_LABEL } from '@/types'

const STATUS_STYLE: Record<ConnectionStatus, { label: string; className: string }> = {
  idle: { label: '未連線', className: 'bg-night-600 text-muted' },
  connecting: { label: '連線中…', className: 'bg-gold text-night-900' },
  connected: { label: '已連線', className: 'bg-guard text-night-900' },
  error: { label: '連線錯誤', className: 'bg-hp text-white' },
  closed: { label: '已離線', className: 'bg-night-600 text-muted' },
}

export function DevRealtimePage() {
  const [searchParams] = useSearchParams()
  const [room, setRoom] = useState(searchParams.get('room') ?? 'TEST')
  const [name, setName] = useState(searchParams.get('name') ?? '')
  const [isTeacher, setIsTeacher] = useState(searchParams.get('teacher') === '1')
  const [joinInfo, setJoinInfo] = useState<{
    room: string
    name: string
    isTeacher: boolean
    joinedAt: number
  } | null>(null)

  const [draft, setDraft] = useState('哈囉！')
  const [log, setLog] = useState<string[]>([])

  const meta = useMemo<PresenceMeta | null>(
    () =>
      joinInfo
        ? {
            isTeacher: joinInfo.isTeacher,
            name: joinInfo.name || '未命名',
            joinedAt: joinInfo.joinedAt,
          }
        : null,
    [joinInfo],
  )

  const { adapter, status, members, selfId } = useRealtimeRoom({
    roomCode: joinInfo?.room ?? null,
    meta,
  })

  // 訂閱測試訊息
  useEffect(() => {
    if (!joinInfo) return
    const off = adapter.on<{ text: string; from: string }>('ping', (payload) => {
      setLog((prev) => [...prev.slice(-49), `← ${payload.from}：${payload.text}`])
    })
    return off
  }, [adapter, joinInfo])

  const join = () => {
    setLog([])
    setJoinInfo({
      room: room.trim().toUpperCase() || 'TEST',
      name: name.trim(),
      isTeacher,
      joinedAt: Date.now(),
    })
  }

  const leave = () => {
    setJoinInfo(null)
  }

  const send = () => {
    if (!draft.trim() || !joinInfo) return
    adapter.broadcast('ping', { text: draft.trim(), from: joinInfo.name || '未命名' })
    setLog((prev) => [...prev.slice(-49), `→ 我：${draft.trim()}`])
  }

  const statusStyle = STATUS_STYLE[status]

  return (
    <div className="game-surface mx-auto flex min-h-full max-w-3xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-pixel text-sm text-gold">即時連線測試</h1>
        <Link to="/teacher" className="font-pixel text-[10px] text-muted hover:text-ink">
          ← 回老師端
        </Link>
      </header>

      <p className="text-xs leading-relaxed text-muted">
        開兩個分頁、輸入<strong className="text-ink">相同房間代碼</strong>，就能互相看到對方並傳訊息。
        這驗證了即時通訊轉接層（M0）正常運作。
      </p>

      {!joinInfo ? (
        <PixelPanel title="加入房間">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">房間代碼</span>
              <input
                value={room}
                onChange={(e) => setRoom(e.target.value.toUpperCase())}
                className="w-full border-[3px] border-black bg-night-800 px-3 py-3 font-pixel text-sm tracking-widest text-ink outline-none focus:border-gold"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted">名稱</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如 老師 / 小明"
                className="w-full border-[3px] border-black bg-night-800 px-3 py-3 text-sm text-ink outline-none placeholder:text-muted/50 focus:border-gold"
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={isTeacher}
                onChange={(e) => setIsTeacher(e.target.checked)}
                className="size-5 accent-[#ffd23f]"
              />
              我是老師端（主機）
            </label>
            <PixelButton size="lg" className="w-full" onClick={join}>
              加入房間
            </PixelButton>
          </div>
        </PixelPanel>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`font-pixel border-[3px] border-black px-3 py-1.5 text-[10px] ${statusStyle.className}`}>
              {statusStyle.label}
            </span>
            <span className="text-xs text-muted">
              房間 <span className="font-pixel text-ink">{joinInfo.room}</span>
              {joinInfo.isTeacher ? '（老師端）' : ''}
            </span>
            <PixelButton variant="danger" size="sm" className="ml-auto" onClick={leave}>
              離線
            </PixelButton>
          </div>

          <PixelPanel title={`房間成員（${members.length}）`}>
            {members.length === 0 ? (
              <p className="text-xs text-muted">尚無成員…</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.clientId}
                    className="flex items-center justify-between border-[3px] border-black bg-night-700 px-3 py-2 text-sm pixel-inset"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{m.isTeacher ? '🧙' : '🛡️'}</span>
                      <span className="text-ink">{m.name ?? '未命名'}</span>
                      {m.clientId === selfId && (
                        <span className="font-pixel text-[9px] text-gold">（我）</span>
                      )}
                    </span>
                    <span className="font-pixel text-[9px] text-muted">
                      {m.role ? ROLE_LABEL[m.role] : m.isTeacher ? 'TEACHER' : 'STUDENT'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PixelPanel>

          <PixelPanel title="廣播測試">
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                className="flex-1 border-[3px] border-black bg-night-800 px-3 py-2.5 text-sm text-ink outline-none focus:border-gold"
              />
              <PixelButton onClick={send}>發送</PixelButton>
            </div>
            <div className="mt-4 max-h-52 space-y-1 overflow-y-auto border-[3px] border-black bg-night-900 p-3 pixel-inset">
              {log.length === 0 ? (
                <p className="text-xs text-muted">尚無訊息…</p>
              ) : (
                log.map((line, i) => (
                  <p key={i} className="text-xs text-ink">
                    {line}
                  </p>
                ))
              )}
            </div>
          </PixelPanel>
        </>
      )}
    </div>
  )
}
