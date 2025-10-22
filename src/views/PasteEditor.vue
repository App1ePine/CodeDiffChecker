<script setup lang="ts">
import type { DiffFile } from '@git-diff-view/file'
import { generateDiffFile } from '@git-diff-view/file'
import { DiffModeEnum, DiffView, setEnableFastDiffTemplate } from '@git-diff-view/vue'
import type { AxiosError } from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '../services/http'
import { useAuthStore } from '../stores/auth'

type PasteResponse = {
  slug: string
  title?: string
  leftContent: string
  rightContent: string
  mode?: DiffModeEnum
  wrap?: boolean
  highlight?: boolean
  theme?: 'light' | 'dark'
  fontSize?: number
  fastDiffEnabled?: boolean
  ownerId?: string
  createdAt?: string
  updatedAt?: string
}

type SaveResponse = {
  slug: string
}

const props = defineProps<{ slug?: string }>()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const leftContent = ref('')
const rightContent = ref('')
const mode = ref<DiffModeEnum>(DiffModeEnum.Split)
const wrap = ref(true)
const highlight = ref(true)
const theme = ref<'light' | 'dark'>('light')
const fontSize = ref(14)
const fastDiffEnabled = ref(true)

const loading = ref(false)
const saving = ref(false)
const editingSlug = ref<string | null>(props.slug ?? null)
const currentPaste = ref<PasteResponse | null>(null)
const lastClonedSlug = ref<string | null>(null)

const isAuthenticated = computed(() => auth.isAuthenticated.value)
const canEditExisting = computed(() => {
  if (!editingSlug.value) return false
  if (!currentPaste.value?.ownerId) return isAuthenticated.value
  return auth.user.value?.id === currentPaste.value.ownerId
})
const canSave = computed(() => {
  if (!isAuthenticated.value) return false
  if (!editingSlug.value) return true
  return canEditExisting.value
})

const shareBase = computed(() => {
  const configured = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined
  if (configured) return configured.replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return 'https://yourdomain'
})

const resetEditor = () => {
  leftContent.value = ''
  rightContent.value = ''
  mode.value = DiffModeEnum.Split
  wrap.value = true
  highlight.value = true
  theme.value = 'light'
  fontSize.value = 14
  fastDiffEnabled.value = true
  currentPaste.value = null
}

const applyPaste = (paste: PasteResponse, assignSlug: boolean) => {
  leftContent.value = paste.leftContent ?? ''
  rightContent.value = paste.rightContent ?? ''
  if (paste.mode) mode.value = paste.mode
  if (typeof paste.wrap === 'boolean') wrap.value = paste.wrap
  if (typeof paste.highlight === 'boolean') highlight.value = paste.highlight
  if (paste.theme) theme.value = paste.theme
  if (typeof paste.fontSize === 'number') fontSize.value = paste.fontSize
  if (typeof paste.fastDiffEnabled === 'boolean') fastDiffEnabled.value = paste.fastDiffEnabled
  currentPaste.value = paste
  if (assignSlug) {
    editingSlug.value = paste.slug
  }
}

const getErrorMessage = (error: unknown) => {
  const axiosError = error as AxiosError<{ message?: string }>
  return axiosError.response?.data?.message ?? axiosError.message ?? '操作失败，请稍后重试'
}

const fetchPaste = async (slug: string, assignSlug = true) => {
  loading.value = true
  try {
    const { data } = await http.get<PasteResponse>(`/pastes/${slug}`)
    const resolved = { ...data, slug: data.slug ?? slug }
    applyPaste(resolved, assignSlug)
    if (!assignSlug) {
      editingSlug.value = null
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

const ensureCloneLoaded = async () => {
  const cloneSlug = route.value.query.clone as string | undefined
  if (editingSlug.value || !cloneSlug || lastClonedSlug.value === cloneSlug) return
  await fetchPaste(cloneSlug, false)
  lastClonedSlug.value = cloneSlug
}

const diffFile = computed<DiffFile | null>(() => {
  setEnableFastDiffTemplate(fastDiffEnabled.value)
  if (leftContent.value === rightContent.value) return null
  const file = generateDiffFile('left', leftContent.value, 'right', rightContent.value, '', '', {})
  file.initTheme(theme.value)
  file.init()
  file.buildSplitDiffLines()
  file.buildUnifiedDiffLines()
  return file
})

const showShareDialog = async (slug: string) => {
  const shareUrl = `${shareBase.value}/p/${slug}`
  try {
    await ElMessageBox.confirm(`请复制访问链接：<br /><strong>${shareUrl}</strong>`, 'Paste 已保存', {
      confirmButtonText: '复制链接',
      cancelButtonText: '关闭',
      type: 'success',
      dangerouslyUseHTMLString: true,
    })
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl)
      ElMessage.success('链接已复制到剪贴板')
    } else {
      ElMessage.info('请手动复制上述链接')
    }
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error('无法展示分享链接')
  }
}

const handleSave = async () => {
  if (!canSave.value) {
    ElMessage.warning('请先登录后再保存')
    router.push({ name: 'login', query: { redirect: route.value.fullPath } })
    return
  }
  if (!leftContent.value && !rightContent.value) {
    ElMessage.warning('请输入需要保存的内容')
    return
  }
  try {
    saving.value = true
    const payload = {
      leftContent: leftContent.value,
      rightContent: rightContent.value,
      mode: mode.value,
      wrap: wrap.value,
      highlight: highlight.value,
      theme: theme.value,
      fontSize: fontSize.value,
      fastDiffEnabled: fastDiffEnabled.value,
    }
    const request = editingSlug.value
      ? http.put<SaveResponse>(`/pastes/${editingSlug.value}`, payload)
      : http.post<SaveResponse>('/pastes', payload)
    const { data } = await request
    const slug = data?.slug ?? editingSlug.value
    if (!slug) {
      throw new Error('未获取到 Paste 标识')
    }
    if (!editingSlug.value) {
      editingSlug.value = slug
      router.replace({ name: 'pasteEdit', params: { slug } })
    }
    await showShareDialog(slug)
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  if (editingSlug.value) {
    await fetchPaste(editingSlug.value)
  } else {
    resetEditor()
    await ensureCloneLoaded()
  }
})

watch(
  () => props.slug,
  async (newSlug, oldSlug) => {
    if (newSlug === oldSlug) return
    if (newSlug) {
      editingSlug.value = newSlug
      await fetchPaste(newSlug)
    } else {
      editingSlug.value = null
      resetEditor()
      await ensureCloneLoaded()
    }
  }
)

watch(
  () => route.value.query.clone,
  async () => {
    if (editingSlug.value) return
    await ensureCloneLoaded()
  }
)
</script>

<template>
  <div class="paste-editor" v-loading="loading">
    <div class="page-header">
      <div>
        <h2>{{ editingSlug ? '编辑 Paste' : '创建 Paste' }}</h2>
        <p class="subtitle">输入左右代码片段以比对差异，并可保存分享链接</p>
      </div>
      <el-button :disabled="!canSave" :loading="saving" type="primary" @click="handleSave">
        {{ editingSlug ? '保存修改' : '保存' }}
      </el-button>
    </div>

    <el-row :gutter="16" class="editor-row">
      <el-col :span="12">
        <el-card class="editor-card">
          <template #header>
            <div class="card-header">
              <span>Left</span>
            </div>
          </template>
          <el-input
            id="leftCodeContent"
            v-model="leftContent"
            :rows="15"
            class="input-area"
            placeholder="请输入旧版代码"
            resize="none"
            type="textarea"
          />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="editor-card">
          <template #header>
            <div class="card-header">
              <span>Right</span>
            </div>
          </template>
          <el-input
            id="rightCodeContent"
            v-model="rightContent"
            :rows="15"
            class="input-area"
            placeholder="请输入新版代码"
            resize="none"
            type="textarea"
          />
        </el-card>
      </el-col>
    </el-row>

    <el-card class="control-card" html-export-exclude>
      <el-space :size="16" wrap>
        <el-radio-group v-model="mode">
          <el-radio-button :label="DiffModeEnum.Split">Split</el-radio-button>
          <el-radio-button :label="DiffModeEnum.Unified">Unified</el-radio-button>
        </el-radio-group>

        <el-switch
          v-model="fastDiffEnabled"
          active-text="启用 FastDiff"
          inactive-text="关闭 FastDiff"
          inline-prompt
        />
        <el-switch
          v-model="wrap"
          active-text="自动换行"
          inactive-text="禁用换行"
          inline-prompt
        />
        <el-switch
          v-model="highlight"
          active-text="语法高亮"
          inactive-text="无高亮"
          inline-prompt
        />

        <el-radio-group v-model="theme">
          <el-radio-button label="light">Light</el-radio-button>
          <el-radio-button label="dark">Dark</el-radio-button>
        </el-radio-group>

        <el-input-number v-model="fontSize" :max="24" :min="12" :step="2">
          <template #suffix>
            <span>px</span>
          </template>
        </el-input-number>
      </el-space>
    </el-card>

    <el-card class="diff-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>差异结果</span>
        </div>
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
  </div>
</template>

<style scoped>
.paste-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0 48px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header h2 {
  margin: 0;
}

.subtitle {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.editor-row {
  margin: 0;
}

.editor-card :deep(.el-card__header) {
  padding: 8px 12px;
}

.editor-card :deep(.el-card__body) {
  padding: 0;
}

.input-area :deep(.el-textarea__inner) {
  border-radius: 0;
  font-family: 'FiraCode Nerd Font', 'FiraCode', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 14px;
  line-height: 1.5;
}

.control-card {
  margin-bottom: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 18px;
  font-weight: 500;
}

.diff-card :deep(.el-card__body) {
  padding: 16px;
}

.diff-wrapper {
  overflow: auto;
}
</style>
