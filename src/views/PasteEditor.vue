<script lang="ts" setup>
import type { DiffFile } from '@git-diff-view/file'
import { generateDiffFile } from '@git-diff-view/file'
import { DiffModeEnum, DiffView, setEnableFastDiffTemplate } from '@git-diff-view/vue'
import { computed, ref } from 'vue'

const sampleLeft = `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')

`
const sampleRight = `import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createApp, type Component } from 'vue'
import App from './App.vue'

const app = createApp(App)

app.use(ElementPlus)

const iconEntries = Object.entries(ElementPlusIconsVue) as [string, Component][]
iconEntries.forEach(([name, component]) => {
  app.component(name, component)
})

app.mount('#app')

`

const leftContent = ref(sampleLeft)
const rightContent = ref(sampleRight)
const mode = ref<DiffModeEnum>(DiffModeEnum.Split)
const wrap = ref(true)
const highlight = ref(true)
const theme = ref<'light' | 'dark'>('light')
const fontSize = ref(14)
const fastDiffEnabled = ref(true)

const diffFile = computed<DiffFile | null>(() => {
  setEnableFastDiffTemplate(fastDiffEnabled.value)
  if (leftContent.value === rightContent.value) return null
  const file = generateDiffFile('tmpFile', leftContent.value, 'tmpFile', rightContent.value, '', '', {})
  file.initTheme(theme.value)
  file.init()
  file.buildSplitDiffLines()
  file.buildUnifiedDiffLines()
  return file
})

const handleSwapContent = () => {
  ;[leftContent.value, rightContent.value] = [rightContent.value, leftContent.value]
}
const handleClearInput = () => {
  leftContent.value = rightContent.value = ''
}
const handleExportHtml = () => {
  const doctype = document.doctype
  const doctypeString = doctype ? new XMLSerializer().serializeToString(doctype) : '<!DOCTYPE html>'

  // 1) 克隆整棵 DOM
  const root = document.documentElement.cloneNode(true) as HTMLElement

  // 2) 固化当前值到可序列化标记
  // 2.1 textarea：用 textContent 作为初始值
  root.querySelectorAll('textarea').forEach((t) => {
    const el = t as HTMLTextAreaElement
    el.textContent = el.value
  })

  // 3) 删除控制按钮卡片（以及你可能标记的其它可排除区域）
  for (let i = 0; i < root.querySelectorAll('[html-export-exclude], .control-card').length; i++) {
    const n = root.querySelectorAll('[html-export-exclude], .control-card')[i]
    n.remove()
  }

  // 4) 移除所有脚本与模块预加载，避免重新挂载覆盖快照
  for (let i = 0; i < root.querySelectorAll('script').length; i++) {
    const s = root.querySelectorAll('script')[i]
    s.remove()
  }

  // 5) 生成并下载静态 HTML
  const html = `${doctypeString}\n${root.outerHTML}`
  const timestamp = new Date().toLocaleString().replace(/[:.]/g, '-')
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `index_${timestamp}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <section class="paste-editor">
    <el-row :gutter="16" class="editor-row">
      <el-col :span="12">
        <el-card class="editor-card">
          <template #header>
            <div class="card-header"><span>Left</span></div>
          </template>
          <el-input
            id="leftCodeContent"
            v-model="leftContent"
            :rows="15"
            class="input-area"
            placeholder="Please input old code text."
            resize="none"
            type="textarea"
          />
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="editor-card">
          <template #header>
            <div class="card-header"><span>Right</span></div>
          </template>
          <el-input
            id="rightCodeContent"
            v-model="rightContent"
            :rows="15"
            class="input-area"
            placeholder="Please input new code text."
            resize="none"
            type="textarea"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-card class="control-card" html-export-exclude>
      <el-space :size="20" wrap>
        <el-radio-group v-model="mode">
          <el-radio-button :label="DiffModeEnum.Split">Split</el-radio-button>
          <el-radio-button :label="DiffModeEnum.Unified">Unified</el-radio-button>
        </el-radio-group>

        <el-switch
          v-model="fastDiffEnabled"
          active-text="Enable FastDiff"
          inactive-text="Disable FastDiff"
          inline-prompt
          size="large"
          style="--el-switch-off-color: #ff4949"
        />
        <el-switch
          v-model="wrap"
          active-text="Enable Wrap"
          inactive-text="Disable Wrap"
          inline-prompt
          size="large"
          style="--el-switch-off-color: #ff4949"
        />
        <el-switch
          v-model="highlight"
          active-text="Enable Highlight"
          inactive-text="Disable Highlight"
          inline-prompt
          size="large"
          style="--el-switch-off-color: #ff4949"
        />

        <el-radio-group v-model="theme">
          <el-radio-button label="light">Light</el-radio-button>
          <el-radio-button label="dark">Dark</el-radio-button>
        </el-radio-group>

        <el-input-number v-model="fontSize" :max="24" :min="14" :step="2">
          <template #suffix>
            <span>px</span>
          </template>
        </el-input-number>

        <el-button plain type="info" @click="handleSwapContent">SwapSide</el-button>
        <el-button plain type="warning" @click="handleClearInput">ClearInput</el-button>
        <el-button plain type="success" @click="handleExportHtml">ExportHTML</el-button>
      </el-space>
    </el-card>

    <el-card class="diff-card" shadow="never">
      <template #header>
        <div class="card-header"><span>差异结果</span></div>
      </template>

      <div v-if="diffFile" class="diff-wrapper">
        <DiffView
          :diff-file="diffFile"
          :diff-view-font-size="fontSize"
          :diff-view-highlight="highlight"
          :diff-view-mode="mode"
          :diff-view-theme="theme"
          :diff-view-wrap="wrap"
        />
      </div>
      <el-empty v-else description="未检测到差异" />
    </el-card>
  </section>
</template>

<style scoped>
.paste-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-row {
  margin-bottom: 0;
}

.control-card {
  margin-bottom: 16px;
}

/* ::v-deep() 相对于 :deep() 对代码编辑器优化, 不会出现警告 */
.editor-card ::v-deep(.el-card__header) {
  padding: 8px;
}

.editor-card ::v-deep(.el-card__body) {
  padding: 0;
}

.editor-card ::v-deep(.el-textarea__inner) {
  border-radius: 0;
  font-family: 'FiraCode Nerd Font', 'FiraCode', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 14px;
  line-height: 1.5;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 22px;
  font-weight: 500;
  padding: 0;
}

.diff-card ::v-deep(.el-card__body) {
  padding: 16px;
}

.diff-wrapper {
  overflow: auto;
}
</style>
