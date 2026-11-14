import { SUPABASE_DASHBOARD_URL } from '@/lib/env'

interface Props {
  /** 目前使用的後端，用來決定提示文字 */
  mode: 'supabase' | 'cloudflare'
  className?: string
}

/**
 * 即時連線後端連不上時顯示的提示。
 *   - supabase  ：最常見是免費專案閒置 7 天被暫停，需到後台按 Restore
 *   - cloudflare：通常是 Worker 還沒部署好或剛部署完還在生效
 */
export function RealtimeDownNotice({ mode, className = '' }: Props) {
  return (
    <div
      className={[
        'border-[3px] border-black bg-hp px-4 py-3 text-sm leading-relaxed text-white pixel-frame',
        className,
      ].join(' ')}
    >
      <p className="font-pixel mb-1.5 text-base text-white">
        ⚠ 連不上{mode === 'supabase' ? 'Supabase' : '即時連線伺服器'}
      </p>

      {mode === 'supabase' ? (
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
      ) : (
        <p>
          學生會無法加入遊戲。請確認 Cloudflare Worker 已成功部署（到{' '}
          <a
            href="https://dash.cloudflare.com/"
            target="_blank"
            rel="noreferrer"
            className="font-pixel underline decoration-2 underline-offset-2"
          >
            Cloudflare 後台
          </a>{' '}
          → <strong>Workers &amp; Pages</strong> 查看狀態與 Logs）。若是剛部署完成，稍等一分鐘再重新整理。
        </p>
      )}

      <p className="mt-1.5 text-white/85">
        如果不是上述原因，請確認這台電腦的網路連線。
      </p>
    </div>
  )
}
