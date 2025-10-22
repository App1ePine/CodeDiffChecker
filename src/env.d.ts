/// <reference types="@rsbuild/core/types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  // biome-ignore lint/complexity/noBannedTypes: reason
  // biome-ignore lint/suspicious/noExplicitAny: reason
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string
  readonly VITE_DEFAULT_USER_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
