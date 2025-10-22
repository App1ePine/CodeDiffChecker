<script setup lang="ts">
import type { DiffFile } from '@git-diff-view/file'
import { generateDiffFile } from '@git-diff-view/file'
import { DiffModeEnum, DiffView, setEnableFastDiffTemplate } from '@git-diff-view/vue'
import type { AxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import http from '../services/http'
import { useAuthStore } from '../stores/auth'

type PasteDetail = {
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
  ownerName?: string
  createdAt?: string
  updatedAt?: string
}

const props = defineProps<{ slug: string }>()

const router = useRouter()
const auth = useAuthStore()

const paste = ref<PasteDetail | null>(null)
const leftContent = ref('')
const rightContent = ref('')
const mode = ref<DiffModeEnum>(DiffModeEnum.Split)
const wrap = ref(true)
const highlight = ref(true)
const theme = ref<'light' | 'dark'>('light')
const fontSize = ref(14)
const fastDiffEnabled = ref(true)
const loading = ref(false)
const errorMessage = ref('')

const isAuthenticated = computed(() => auth.isAuthenticated.value)
const isOwner = computed(() => {
  if (!paste.value?.ownerId) return false
  return auth.user.value?.id === paste.value.ownerId
})

const diffFile = computed<DiffFile | null>(() => {
  setEnableFastDiffTemplate(fastDiffEnabled.value)
  if (!leftContent.value && !rightContent.value) return null
  if (leftContent.value === rightContent.value) return null
  const file = generateDiffFile('left', leftContent.value, 'right', rightContent.value, '', '', {})
  file.initTheme(theme.value)
  file.init()
  file.buildSplitDiffLines()
  file.buildUnifiedDiffLines()
  return file
})

const applyDetail = (detail: PasteDetail) => {
  paste.value = detail
  leftContent.value = detail.leftContent ?? ''
  rightContent.value = detail.rightContent ?? ''
  mode.value = detail.mode ?? DiffModeEnum.Split
  wrap.value = typeof detail.wrap === 'boolean' ? detail.wrap : true
  highlight.value = typeof detail.highlight === 'boolean' ? detail.highlight : true
  theme.value = detail.theme ?? 'light'
  fontSize.value = detail.fontSize ?? 14
  fastDiffEnabled.value = typeof detail.fastDiffEnabled === 'boolean' ? detail.fastDiffEnabled : true
}

const fetchPaste = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await http.get<PasteDetail>(`/pastes/${props.slug}`)
    const resolved = { ...data, slug: data.slug ?? props.slug }
    applyDetail(resolved)
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>
    if (axiosError.response?.status === 404) {
      errorMessage.value = '未找到对应的 Paste'
    } else {
      errorMessage.value = axiosError.response?.data?.message ?? axiosError.message ?? '加载失败，请稍后重试'
    }
  } finally {
    loading.value = false
  }
}

const handleEdit = () => {
  if (!paste.value) return
  router.push({ name: 'pasteEdit', params: { slug: paste.value.slug } })
}

const handleClone = () => {
  router.push({ name: 'editor', query: { clone: props.slug } })
  ElMessage.success('已将内容复制到新建页面')
}

onMounted(fetchPaste)

watch(
  () => props.slug,
  async (newSlug, oldSlug) => {
    if (newSlug === oldSlug) return
    await fetchPaste()
  }
)
</script>

<template>
  <div class="paste-viewer" v-loading="loading">
    <el-card class="diff-card" shadow="never">
      <template #header>
        <div class="card-header">
          <div class="title-block">
            <h2>{{ paste?.title ?? 'Diff 详情' }}</h2>
            <p v-if="paste?.updatedAt || paste?.createdAt" class="meta">
              <span v-if="paste?.ownerName">由 {{ paste.ownerName }} 创建</span>
              <span v-if="paste?.updatedAt"> · 更新于 {{ paste.updatedAt }}</span>
              <span v-else-if="paste?.createdAt"> · 创建于 {{ paste.createdAt }}</span>
            </p>
          </div>
          <el-space wrap>
            <el-button v-if="isOwner" type="primary" @click="handleEdit">编辑</el-button>
            <el-button v-if="isAuthenticated" plain type="success" @click="handleClone">
              复制到新建
            </el-button>
          </el-space>
        </div>
      </template>

      <template v-if="errorMessage">
        <el-empty :description="errorMessage" />
      </template>
      <template v-else>
        <div class="viewer-controls">
          <el-space :size="16" wrap>
            <el-radio-group v-model="mode">
              <el-radio-button :label="DiffModeEnum.Split">Split</el-radio-button>
              <el-radio-button :label="DiffModeEnum.Unified">Unified</el-radio-button>
            </el-radio-group>
            <el-switch v-model="wrap" active-text="自动换行" inactive-text="禁用换行" inline-prompt />
            <el-switch v-model="highlight" active-text="语法高亮" inactive-text="无高亮" inline-prompt />
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
        </div>
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
      </template>
    </el-card>
  </div>
</template>

<style scoped>
.paste-viewer {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 0 48px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.title-block h2 {
  margin: 0;
}

.meta {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.viewer-controls {
  margin-bottom: 16px;
}

.diff-card :deep(.el-card__body) {
  padding: 16px;
}

.diff-wrapper {
  overflow: auto;
}
</style>
