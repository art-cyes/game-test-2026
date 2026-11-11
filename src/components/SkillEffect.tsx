export type SkillFxKind = 'shield' | 'ult' | 'bossUlt'

/** 每次答對時的斬擊 + 火花（用 key 讓動畫重播） */
export function SlashBurst({ seed = 0, className = '' }: { seed?: number; className?: string }) {
  const sparks = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2 + seed * 0.7
    const dist = 70 + ((seed * 13 + i * 29) % 60)
    return {
      dx: `${Math.round(Math.cos(angle) * dist)}px`,
      dy: `${Math.round(Math.sin(angle) * dist * 0.7)}px`,
      delay: `${(i % 3) * 45}ms`,
    }
  })
  return (
    <div className={['skill-fx', className].join(' ')} aria-hidden>
      <div className="slash-arc" style={{ ['--rot' as string]: '-30deg' }} />
      <div className="slash-arc slash-arc--b" style={{ ['--rot' as string]: '22deg' }} />
      {sparks.map((s, i) => (
        <span
          key={i}
          className="slash-spark"
          style={{
            ['--dx' as string]: s.dx,
            ['--dy' as string]: s.dy,
            animationDelay: s.delay,
          }}
        />
      ))}
    </div>
  )
}

/**
 * 技能特效（純 CSS 動畫，覆蓋在戰鬥場景上）
 *  - shield ：藍色防護罩升起 + 擴散環
 *  - ult    ：放射光束 + 全畫面閃光 + 衝擊波
 *  - bossUlt：暗紅衝擊 + 衝擊波
 */
export function SkillEffect({ kind, className = '' }: { kind: SkillFxKind; className?: string }) {
  return (
    <div className={['skill-fx', className].join(' ')} aria-hidden>
      {kind === 'shield' && (
        <>
          <div className="skill-fx__dome" />
          <div className="skill-fx__ring" />
        </>
      )}
      {kind === 'ult' && (
        <>
          <div className="skill-fx__darken" />
          <div className="skill-fx__beam" />
          <div className="skill-fx__rays" />
          <div className="skill-fx__halo" />
          <div className="skill-fx__flash" />
          <div className="skill-fx__shock" />
          {/* 多段斬擊 */}
          <div className="slash-arc" style={{ ['--rot' as string]: '-34deg' }} />
          <div
            className="slash-arc slash-arc--b"
            style={{ ['--rot' as string]: '26deg', animationDelay: '120ms' }}
          />
          <div
            className="slash-arc"
            style={{ ['--rot' as string]: '-8deg', animationDelay: '220ms' }}
          />
        </>
      )}
      {kind === 'bossUlt' && (
        <>
          <div className="skill-fx__boss" />
          <div className="skill-fx__shock" style={{ borderColor: 'rgba(255,90,90,0.95)' }} />
        </>
      )}
    </div>
  )
}
