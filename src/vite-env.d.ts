/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** auto（預設） / mock / supabase */
  readonly VITE_REALTIME_MODE?: string
  /** 對外網址（部署後填入，例如 https://xxx.vercel.app）；學生 QR 會用此網址 */
  readonly VITE_PUBLIC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
