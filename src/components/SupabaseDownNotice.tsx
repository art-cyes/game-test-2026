import { SUPABASE_DASHBOARD_URL } from '@/lib/env'

/**
 * Supabase 連不上時顯示的提示。
 * 最常見的原因是免費專案閒置 7 天被自動暫停，需要到後台按 Restore。
 */
export function SupabaseDownNotice({ className = '' }: { className?: string }) {
  return (
    <div
      className={[
        'border-[3px] border-black bg-hp px-4 py-3 text-sm leading-relaxed text-white pixel-frame',
        className,
      ].join(' ')}
    >
      <p className="font-pixel mb-1.5 text-base text-white">⚠ 連不上 Supabase</p>
      <p>
        學生會無法加入遊戲。最常見的原因是<strong>免費專案閒置 7 天被自動暫停</strong>了。
        請開啟{' '}
        <a
          href={SUPABASE_DASHBOARD_URL}
          target="_blank"
          rel="noreferrer"
          className="font-pixel underline decoration-2 underline-offset-2"
        >
          Supabase 後台
        </a>{' '}
        → 找到這個專案 → 按 <strong>Restore / Resume</strong>，等 1～2 分鐘後重新整理本頁即可。
      </p>
      <p className="mt-1.5 text-white/85">
        如果不是暫停，請確認這台電腦的網路，以及 Vercel 的環境變數是否正確。
      </p>
    </div>
  )
}
