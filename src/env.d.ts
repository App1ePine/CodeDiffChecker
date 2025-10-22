/// <reference types="@rsbuild/core/types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  // biome-ignore lint/complexity/noBannedTypes: reason
  // biome-ignore lint/suspicious/noExplicitAny: reason
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_PUBLIC_BASE_URL?: string
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv
}
