import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="game-surface mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-8 px-4 py-10 text-center">
      <div>
        <p className="font-pixel mb-3 text-[10px] tracking-widest text-muted">PIXEL HEROES</p>
        <h1 className="font-pixel text-2xl leading-relaxed text-gold drop-shadow-[3px_3px_0_rgba(0,0,0,0.9)] sm:text-3xl">
          像素勇者團
        </h1>
        <h2 className="font-pixel mt-4 text-base text-ink drop-shadow-[3px_3px_0_rgba(0,0,0,0.9)] sm:text-xl">
          魔王城大作戰
        </h2>
      </div>

      <p className="text-sm leading-relaxed text-muted">
        用手機掃描老師畫面上的 QR Code
        <br />
        就能加入勇者團，一起打敗大魔王！
      </p>

      <p className="text-4xl animate-float">🏰</p>

      <Link
        to="/teacher"
        className="font-pixel mt-4 text-[10px] text-muted/60 transition hover:text-gold"
      >
        老師入口 →
      </Link>
    </div>
  )
}
