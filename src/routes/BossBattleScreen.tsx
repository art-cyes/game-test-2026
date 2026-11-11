import { useEffect, useMemo, useState } from 'react'
import { AnimatedBoss } from '@/components/AnimatedBoss'
import { AnimatedHero, type ActorState } from '@/components/AnimatedHero'
import { BattleScene } from '@/components/BattleScene'
import { PixelButton } from '@/components/PixelButton'
import { SkillEffect, SlashBurst } from '@/components/SkillEffect'
import { StatBar } from '@/components/StatBar'
import { BOSS_PRESETS, BOSS_ULT_WARN_SEC, TEAM_SKILLS } from '@/config/gameDefaults'
import { HERO_SPRITES } from '@/lib/assets'
import { startBgm, stopBgm } from '@/lib/audio'
import { useSkillEffect, useTransientState } from '@/hooks/useSkillEffect'
import type { BattleEvent, BattleState, PlayerBattleStats } from '@/lib/game/battle'
import type { PlayerSlot } from '@/lib/game/lobby'
import type { LiveEvent } from '@/hooks/useHostBattle'
import { BOSS_DIFFICULTY_LABEL, ROLE_LABEL, type BossDifficulty, type Role } from '@/types'

interface Props {
  className: string
  bossDifficulty: BossDifficulty
  battle: BattleState
  stats: PlayerBattleStats[]
  players: PlayerSlot[]
  events: LiveEvent[]
  maxPlayers: number
  questionCount: number
  usingDemoQuestions: boolean
  onUseDefense: () => void
  onUseUlt: () => void
  onEndBattle: () => void
}

const ROLES: Role[] = ['warrior', 'priest', 'mage']
const SKILL_KINDS = ['skill-defense', 'skill-ult', 'boss-ult']

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** 把事件轉成戰鬥日誌的一行 */
function logLine(e: BattleEvent): { icon: string; text: string; tone: string } | null {
  switch (e.kind) {
    case 'damage':
      return {
        icon: '⚔',
        text: `${e.seatNo} ${e.name} 攻擊 -${e.amount}${e.combo && e.combo >= 3 ? `（連擊 x${e.combo}）` : ''}`,
        tone: 'text-guard',
      }
    case 'wrong':
      return { icon: '✗', text: `${e.seatNo} ${e.name} 答錯`, tone: 'text-hp' }
    case 'boss-attack':
      return { icon: '💢', text: `魔王攻擊 -${e.amount}`, tone: 'text-hp' }
    case 'boss-ult-warning':
      return { icon: '⚠', text: e.text ?? '魔王大招即將落下', tone: 'text-gold' }
    case 'boss-ult':
      return { icon: '💥', text: `${e.text ?? '魔王大招'} -${e.amount}`, tone: 'text-hp' }
    case 'block':
      return { icon: '🛡', text: `護盾擋下 ${e.amount} 點傷害`, tone: 'text-mana' }
    case 'skill-defense':
      return {
        icon: TEAM_SKILLS.defense.emoji,
        text: `${TEAM_SKILLS.defense.name}！護盾 ${e.amount}`,
        tone: 'text-mana',
      }
    case 'skill-ult':
      return {
        icon: TEAM_SKILLS.ult.emoji,
        text: `${TEAM_SKILLS.ult.name}！${e.amount ?? ''} 傷害`,
        tone: 'text-gold',
      }
    case 'info':
      return e.text ? { icon: '★', text: e.text, tone: 'text-muted' } : null
    default:
      return null
  }
}

export function BossBattleScreen({
  className,
  bossDifficulty,
  battle,
  stats,
  players,
  events,
  maxPlayers,
  questionCount,
  usingDemoQuestions,
  onUseDefense,
  onUseUlt,
  onEndBattle,
}: Props) {
  const boss = BOSS_PRESETS[bossDifficulty]
  const running = battle.status === 'running'
  const stunned = battle.bossStunSec > 0

  /* ---------------- 觸發來源 ---------------- */

  const lastDamage = useMemo(
    () => [...events].reverse().find((e) => e.event.kind === 'damage') ?? null,
    [events],
  )
  const lastBossHit = useMemo(
    () =>
      [...events].reverse().find((e) => e.event.kind === 'boss-attack' || e.event.kind === 'boss-ult') ??
      null,
    [events],
  )
  const lastSkill = useMemo(
    () => [...events].reverse().find((e) => SKILL_KINDS.includes(e.event.kind)) ?? null,
    [events],
  )

  const fx = useSkillEffect(
    lastSkill ? { kind: lastSkill.event.kind, id: lastSkill.id } : null,
    1300,
  )

  // 每位職業最近一次答對 → 播放攻擊動作
  const roleHits = useMemo(() => {
    const map: Partial<Record<Role, number>> = {}
    for (const e of [...events].reverse()) {
      if (e.event.kind !== 'damage') continue
      const role = players.find((p) => p.seatNo === e.event.seatNo)?.role
      if (role && map[role] === undefined) map[role] = e.id
    }
    return map
  }, [events, players])

  const warriorHit = useTransientState(
    roleHits.warrior !== undefined ? { id: roleHits.warrior } : null,
    'attack',
    'idle',
    620,
  )
  const priestHit = useTransientState(
    roleHits.priest !== undefined ? { id: roleHits.priest } : null,
    'attack',
    'idle',
    620,
  )
  const mageHit = useTransientState(
    roleHits.mage !== undefined ? { id: roleHits.mage } : null,
    'attack',
    'idle',
    620,
  )
  const heroStates: Record<Role, ActorState> = {
    warrior: fx === 'shield' || fx === 'ult' ? 'cast' : warriorHit,
    priest: fx === 'shield' || fx === 'ult' ? 'cast' : priestHit,
    mage: fx === 'shield' || fx === 'ult' ? 'cast' : mageHit,
  }

  // 魔王動作
  const bossHurt = useTransientState(
    lastDamage ? { id: lastDamage.id } : null,
    'hurt',
    'idle',
    430,
  )
  const bossLunge = useTransientState(
    lastBossHit ? { id: lastBossHit.id } : null,
    'attack',
    'idle',
    560,
  )
  const bossState: ActorState | 'down' =
    battle.status === 'win'
      ? 'down'
      : fx === 'bossUlt'
        ? 'cast'
        : bossLunge !== 'idle'
          ? 'attack'
          : bossHurt

  const [shaking, setShaking] = useState(false)
  useEffect(() => {
    if (!lastBossHit) return
    setShaking(true)
    const t = setTimeout(() => setShaking(false), 460)
    return () => clearTimeout(t)
  }, [lastBossHit])

  useEffect(() => {
    startBgm()
    return () => stopBgm()
  }, [])

  /* ---------------- 大字幕 ---------------- */

  const lastSubtitle = useMemo(
    () =>
      [...events].reverse().find((e) =>
        ['skill-defense', 'skill-ult', 'boss-ult', 'boss-ult-warning', 'info'].includes(e.event.kind),
      ) ?? null,
    [events],
  )

  const [subtitle, setSubtitle] = useState<{ text: string; tone: string } | null>(null)
  useEffect(() => {
    if (!lastSubtitle) return
    const e = lastSubtitle.event
    const tone =
      e.kind === 'boss-ult' || e.kind === 'boss-ult-warning'
        ? 'bg-hp text-white'
        : e.kind === 'skill-ult'
          ? 'bg-gold text-night-900'
          : e.kind === 'skill-defense'
            ? 'bg-mana text-night-900'
            : 'bg-panel-light text-ink'
    const text =
      e.kind === 'boss-ult'
        ? `💥 魔王大招「${battle.bossUltName}」命中！造成 ${e.amount} 點傷害`
        : e.kind === 'skill-defense'
          ? `${TEAM_SKILLS.defense.emoji} 「${TEAM_SKILLS.defense.name}」！全隊護盾 ${e.amount}`
          : e.kind === 'skill-ult'
            ? `${TEAM_SKILLS.ult.emoji} 「${TEAM_SKILLS.ult.name}」！造成 ${e.amount} 傷害`
            : (e.text ?? '')
    setSubtitle({ text, tone })
    const t = setTimeout(() => setSubtitle(null), 3200)
    return () => clearTimeout(t)
  }, [lastSubtitle, battle.bossUltName])

  /* ---------------- 衍生資料 ---------------- */

  const onlinePlayers = useMemo(() => players.filter((p) => p.online), [players])

  const roleCounts = useMemo(() => {
    const map: Record<Role, number> = { warrior: 0, priest: 0, mage: 0 }
    for (const p of onlinePlayers) map[p.role] += 1
    return map
  }, [onlinePlayers])

  const ranking = useMemo(() => [...stats].sort((a, b) => b.damage - a.damage).slice(0, 5), [stats])

  const ultContributors = useMemo(
    () =>
      [...stats]
        .filter((s) => s.ultEnergy > 0)
        .sort((a, b) => b.ultEnergy - a.ultEnergy)
        .slice(0, 2)
        .map((s) => s.seatNo),
    [stats],
  )

  const logEntries = useMemo(() => {
    const list: { id: number; icon: string; text: string; tone: string }[] = []
    for (const e of [...events].reverse()) {
      const line = logLine(e.event)
      if (line) list.push({ id: e.id, ...line })
      if (list.length >= 4) break
    }
    return list
  }, [events])

  const defenseReady = running && battle.defenseEnergy >= battle.defenseThreshold
  const ultReady = running && battle.ultEnergy >= battle.ultThreshold
  const ultGaugePct = Math.min(100, Math.round((battle.ultEnergy / battle.ultThreshold) * 100))
  const abilityPct = Math.max(
    0,
    100 -
      Math.min(100, Math.round((battle.bossUltSec / Math.max(1, battle.bossUltIntervalSec)) * 100)),
  )
  const warningActive = running && battle.bossUltSec > 0 && battle.bossUltSec <= BOSS_ULT_WARN_SEC
  const timeRunning = battle.remainingSec <= battle.totalSec * 0.2
  const statusLabel = !running ? '已結束' : warningActive ? '魔王蓄力中' : '戰鬥中'

  return (
    <div className="game-surface flex h-[100dvh] flex-col gap-2 overflow-hidden p-2 lg:flex-row">
      {/* ==================== 左：戰場 ==================== */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        {/* 頂部：魔王資訊 + 血量 + 大招條 + 計時 */}
        <div className="rpg-panel flex shrink-0 flex-wrap items-center gap-4 py-2">
          <div className="shrink-0">
            <p className="font-pixel text-xl leading-tight text-gold">{battle.bossName}</p>
            <span className="font-pixel mt-1 inline-block border-[3px] border-black bg-night-600 px-3 py-0.5 text-sm text-ink">
              {BOSS_DIFFICULTY_LABEL[bossDifficulty]}
            </span>
          </div>

          <div className="min-w-[200px] flex-1 space-y-2">
            <StatBar
              value={battle.bossHp}
              max={battle.bossHpMax}
              colorClass="bg-hp"
              size="md"
              showNumbers
              textSize="xl"
              label="魔王 HP"
            />
            <StatBar
              value={abilityPct}
              max={100}
              colorClass={warningActive ? 'bg-hp animate-pulse-soft' : 'bg-mana'}
              size="sm"
              textSize="xl"
              label={
                warningActive
                  ? `魔王能力（大招 ${battle.bossUltSec} 秒後）`
                  : `魔王能力（蓄力 ${battle.bossUltSec}s）`
              }
            />
          </div>

          <div
            className={[
              'shrink-0 border-[3px] border-black px-5 py-1 text-center pixel-frame',
              timeRunning ? 'animate-pulse-soft bg-hp text-white' : 'bg-night-700 text-gold',
            ].join(' ')}
          >
            <p className="font-pixel text-sm opacity-70">剩餘時間</p>
            <p className="font-pixel text-4xl tabular-nums">{formatTime(battle.remainingSec)}</p>
          </div>
        </div>

        {/* 戰場（吃滿剩餘高度） */}
        <BattleScene
          tone={stunned ? 'stunned' : warningActive ? 'warning' : 'normal'}
          className={[
            'scanlines relative flex min-h-0 flex-1 items-center justify-center overflow-hidden',
            'border-[3px] border-black pixel-frame',
            shaking ? 'animate-shake' : '',
          ].join(' ')}
        >
          {fx && <SkillEffect kind={fx} />}
          {/* 每次答對的斬擊特效（用 key 讓動畫重播） */}
          {lastDamage && !fx && <SlashBurst key={lastDamage.id} seed={lastDamage.id} />}

          {/* 魔王大招警告 */}
          {warningActive && (
            <div className="absolute inset-x-4 top-3 z-30">
              <div className="animate-pulse-soft border-[3px] border-black bg-hp px-5 py-3 text-center pixel-frame">
                <p className="font-pixel text-lg leading-relaxed text-white sm:text-2xl">
                  ⚠ 魔王大招「{battle.bossUltName}」{battle.bossUltSec} 秒後落下！
                </p>
                <p className="mt-1.5 text-sm text-white/90 sm:text-base">
                  大招傷害 {battle.bossUltPower} 點，只有護盾能扛下
                  {battle.shieldHp > 0 ? `（目前護盾 ${battle.shieldHp}）` : '（目前沒有護盾！）'}
                </p>
              </div>
            </div>
          )}

          {/* 傷害飄浮數字 */}
          <div className="pointer-events-none absolute inset-0 z-20">
            {events
              .filter((e) => e.event.kind === 'damage' || e.event.kind === 'block')
              .map((e) => {
                const isBlock = e.event.kind === 'block'
                return (
                  <span
                    key={e.id}
                    className={[
                      'font-pixel animate-damage-float absolute top-1/4 text-lg drop-shadow-[2px_2px_0_rgba(0,0,0,0.9)]',
                      isBlock ? 'text-mana' : 'text-gold',
                    ].join(' ')}
                    style={{ left: `${54 + (((e.id * 37) % 60) - 30)}%` }}
                  >
                    {isBlock ? `🛡 -${e.event.amount}` : `-${e.event.amount}`}
                  </span>
                )
              })}
          </div>

          {/* 左：三位勇者直排、側面朝右；右：魔王 */}
          <div className="relative z-10 flex size-full items-center justify-between gap-2 px-2 pb-16 pt-1 sm:gap-4 sm:px-4">
            <div className="flex flex-col gap-1 sm:gap-2">
              {ROLES.map((r) => (
                <div key={r} className="flex items-center gap-2">
                  <AnimatedHero
                    role={r}
                    state={heroStates[r]}
                    facing="right"
                    title={ROLE_LABEL[r]}
                    className="scene-hero shrink-0 drop-shadow-[0_6px_14px_rgba(0,0,0,0.6)]"
                  />
                  <p className="font-pixel flex items-center gap-1.5 border-[3px] border-black bg-night-900/85 px-2 py-1 text-xs text-ink sm:text-sm">
                    <img src={HERO_SPRITES[r].face} alt="" className="pixelated size-5" />
                    {ROLE_LABEL[r]}
                    <span className="text-gold">×{roleCounts[r]}</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="relative flex shrink-0 flex-col items-center">
              <AnimatedBoss
                difficulty={bossDifficulty}
                state={bossState}
                title={boss.name}
                className="scene-boss drop-shadow-[0_16px_34px_rgba(0,0,0,0.7)]"
              />
              {stunned && (
                <p className="font-pixel animate-pulse-soft -mt-2 text-base text-mana">
                  💫 魔王暈眩中（{battle.bossStunSec}）
                </p>
              )}
              {!stunned && running && battle.nextAttackSec <= 3 && (
                <p className="font-pixel animate-pulse-soft -mt-2 text-base text-hp">
                  ⚠ 魔王攻擊倒數 {battle.nextAttackSec}
                </p>
              )}
            </div>
          </div>

          {/* 大字幕 */}
          {subtitle && (
            <div className="absolute inset-x-3 bottom-3 z-30">
              <p
                className={[
                  'font-pixel animate-pulse-soft border-[3px] border-black px-5 py-3 text-center text-lg leading-relaxed pixel-frame sm:text-2xl',
                  subtitle.tone,
                ].join(' ')}
              >
                {subtitle.text}
              </p>
            </div>
          )}
        </BattleScene>

        {/* 底部：血條 + 技能（固定高度，不擠壓戰場） */}
        <div className="grid shrink-0 gap-2 md:grid-cols-4">
          <div className="rpg-panel space-y-2 py-2 md:col-span-2">
            <StatBar
              label="英雄血條"
              value={battle.teamHp}
              max={battle.teamHpMax}
              colorClass="bg-guard"
              size="md"
              showNumbers
              textSize="xl"
            />
            {battle.shieldHp > 0 ? (
              <StatBar
                label="🛡 護盾"
                value={battle.shieldHp}
                max={battle.shieldMax}
                colorClass="bg-mana"
                size="sm"
                showNumbers
                textSize="xl"
                highlightFull
              />
            ) : (
              <p className="text-sm text-muted">🛡 目前沒有護盾</p>
            )}
          </div>

          <div className="rpg-panel py-2">
            <StatBar
              label={`${TEAM_SKILLS.defense.emoji} ${TEAM_SKILLS.defense.name}`}
              value={battle.defenseEnergy}
              max={battle.defenseThreshold}
              colorClass="bg-mana"
              size="sm"
              showNumbers
              textSize="xl"
              highlightFull
            />
            <PixelButton
              size="lg"
              variant={defenseReady ? 'primary' : 'secondary'}
              className={['mt-2 w-full', defenseReady ? 'animate-pulse-soft' : ''].join(' ')}
              disabled={!defenseReady}
              onClick={onUseDefense}
            >
              {defenseReady ? `${TEAM_SKILLS.defense.emoji} 發動！` : '能量不足'}
            </PixelButton>
          </div>

          <div className="rpg-panel py-2">
            <StatBar
              label={`${TEAM_SKILLS.ult.emoji} ${TEAM_SKILLS.ult.name} ${ultGaugePct}%`}
              value={battle.ultEnergy}
              max={battle.ultThreshold}
              colorClass="bg-gold"
              size="sm"
              textSize="xl"
              highlightFull
            />
            <PixelButton
              size="lg"
              variant={ultReady ? 'primary' : 'secondary'}
              className={['mt-2 w-full', ultReady ? 'animate-pulse-soft' : ''].join(' ')}
              disabled={!ultReady}
              onClick={onUseUlt}
            >
              {ultReady ? `${TEAM_SKILLS.ult.emoji} 發動！` : '能量不足'}
            </PixelButton>
          </div>
        </div>
      </div>

      {/* ==================== 右：學生監控 ==================== */}
      <aside className="flex w-full shrink-0 flex-col gap-2 overflow-hidden lg:w-80 xl:w-96">
        <div className="rpg-panel shrink-0 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-pixel text-base text-gold">⚔ 魔王戰</h3>
            <span className={`font-pixel text-sm ${warningActive ? 'text-hp' : 'text-guard'}`}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-ink">
            {BOSS_DIFFICULTY_LABEL[bossDifficulty]}・{battle.totalSec / 60} 分・
            <span className="ml-1 text-muted">
              角色 {players.length} 人／上線 {onlinePlayers.length}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted">
            題庫 {questionCount} 題{usingDemoQuestions ? '（示範）' : ''}　·　✓
            <span className="text-guard"> {battle.totalCorrect}</span> / ✗
            <span className="text-hp"> {battle.totalWrong}</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            🛡 {battle.defenseUsed} 次　🔥 {battle.ultUsed} 次　·　大招功勞：
            {ultContributors.length > 0 ? `${ultContributors.join('、')} 號` : '—'}
          </p>
          {running && (
            <PixelButton variant="secondary" size="sm" className="mt-2 w-full" onClick={onEndBattle}>
              ✕ 提前結束
            </PixelButton>
          )}
        </div>

        {/* 座號監控 */}
        <div className="rpg-panel shrink-0 py-2">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-pixel text-base text-gold">上線監控</h3>
            <span className="font-pixel text-sm text-muted">
              {onlinePlayers.length} / {maxPlayers}
            </span>
          </div>
          {players.length === 0 ? (
            <p className="text-sm text-muted">沒有人在線。</p>
          ) : (
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
              {players.map((p) => {
                const cls = !p.online
                  ? 'bg-night-800 text-muted/60'
                  : p.away
                    ? 'bg-gold text-night-900'
                    : 'bg-guard text-night-900'
                return (
                  <span
                    key={p.seatNo}
                    title={`${p.seatNo} ${p.name}・${ROLE_LABEL[p.role]}・${
                      !p.online ? '離線' : p.away ? '不在分頁' : '在線'
                    }`}
                    className={`font-pixel flex size-9 items-center justify-center border-[3px] border-black text-sm ${cls}`}
                  >
                    {p.seatNo}
                  </span>
                )
              })}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2.5 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="size-3 border-2 border-black bg-guard" />在線
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 border-2 border-black bg-gold" />不在分頁
            </span>
            <span className="flex items-center gap-1">
              <span className="size-3 border-2 border-black bg-night-800" />離線
            </span>
          </div>
        </div>

        {/* 排行 + 戰鬥紀錄（吃滿剩餘高度） */}
        <div className="rpg-panel flex min-h-0 flex-1 flex-col py-2">
          <h3 className="font-pixel mb-2 shrink-0 text-base text-gold">⚔ 即時排行</h3>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted">開始答題吧！</p>
          ) : (
            <ol className="shrink-0 space-y-1">
              {ranking.map((s, i) => (
                <li key={s.seatNo} className="flex items-center gap-2 text-sm">
                  <span className="font-pixel w-5 text-muted">{i + 1}</span>
                  <span className="font-pixel w-7 text-ink">{s.seatNo}</span>
                  <span className="flex-1 truncate text-ink">{s.name}</span>
                  <span className="font-pixel text-gold">{s.damage}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-3 flex min-h-0 flex-1 flex-col border-t-2 border-black/60 pt-2">
            <h3 className="font-pixel mb-1 shrink-0 text-base text-gold">戰鬥紀錄</h3>
            <div className="min-h-0 flex-1 overflow-hidden">
              {logEntries.length === 0 ? (
                <p className="text-sm text-muted">還沒有事件…</p>
              ) : (
                <ul className="space-y-1">
                  {logEntries.map((l) => (
                    <li key={l.id} className={`truncate text-sm ${l.tone}`}>
                      {l.icon} {l.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-1 shrink-0 truncate text-xs text-muted">{className}</p>
          </div>
        </div>
      </aside>
    </div>
  )
}

