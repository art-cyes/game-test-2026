import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="game-surface flex min-h-full flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="font-pixel text-4xl text-gold">404</p>
      <p className="text-sm text-muted">這個房間不存在，或勇者走錯路了。</p>
      <Link to="/" className="font-pixel text-[10px] text-muted hover:text-ink">
        ← 回到首頁
      </Link>
    </div>
  )
}
