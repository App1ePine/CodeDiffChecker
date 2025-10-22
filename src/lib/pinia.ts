import type { App } from 'vue'

/**
 * 极简版 Pinia 替代实现，仅满足当前项目的状态管理需求。
 * - createPinia 返回一个可以被 app.use() 调用的插件，但不会注入额外行为。
 * - defineStore 通过闭包缓存 store 实例，确保在多个组件间共享。
 */
export function createPinia() {
  return {
    install(_app: App) {
      // 在真实 Pinia 中这里会设置 devtools、插件等逻辑。
      // 对于当前项目，只需要保持接口兼容即可。
    }
  }
}

export function defineStore<Store extends Record<string, unknown>>(
  _id: string,
  setup: () => Store
) {
  let store: Store | null = null

  return function useStore(): Store {
    if (store === null) {
      store = setup()
    }
    return store
  }
}
