/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** auto（預設） / mock / cloudflare / supabase */
  readonly VITE_REALTIME_MODE?: string
  /** Cloudflare Worker 位址；留空 = 用目前網址（部署後前端與 Worker 同一個網域） */
  readonly VITE_REALTIME_URL?: string
  /** 對外網址（選填）；學生 QR 會用此網址，未設定時用瀏覽器目前網址 */
  readonly VITE_PUBLIC_URL?: string
  /** 舊版備援：Supabase */
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
