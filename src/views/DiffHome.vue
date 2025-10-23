<script lang="ts" setup>
import type { DiffFile } from '@git-diff-view/file'
import { generateDiffFile } from '@git-diff-view/file'
import { DiffModeEnum, DiffView, setEnableFastDiffTemplate } from '@git-diff-view/vue'
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import { createShare } from '@/api/shares'
import { ApiError } from '@/api/types'
import { useAuthStore } from '@/stores/auth'
import { parseDatePickerString } from '@/utils/datetime'

const sampleLeft = `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
`

const sampleRight = `import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
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

const shareDialogVisible = ref(false)
const shareSubmitting = ref(false)
const lastShareUrl = ref<string | null>(null)
const shareForm = reactive({
  title: '',
  hidden: false,
  expiresAt: null as string | null,
})

const authStore = useAuthStore()

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

const hasDiff = computed(() => Boolean(diffFile.value))

function swapContent() {
  ;[leftContent.value, rightContent.value] = [rightContent.value, leftContent.value]
}

function clearContent() {
  leftContent.value = ''
  rightContent.value = ''
  lastShareUrl.value = null
}

function loadSamples() {
  leftContent.value = sampleLeft
  rightContent.value = sampleRight
  lastShareUrl.value = null
}

function openShareDialog() {
  if (!hasDiff.value) {
    ElMessage.warning('There is no difference to share yet.')
    return
  }
  shareForm.title = `Diff ${new Date().toLocaleString()}`
  shareForm.hidden = false
  shareForm.expiresAt = null
  shareDialogVisible.value = true
}

async function submitShare() {
  if (!hasDiff.value) {
    ElMessage.warning('There is no difference to share yet.')
    return
  }

  shareSubmitting.value = true
  try {
    const payload = {
      title: shareForm.title.trim() || 'Untitled diff',
      leftContent: leftContent.value,
      rightContent: rightContent.value,
      hidden: shareForm.hidden,
      expiresAt: (() => {
        if (!shareForm.expiresAt) return null
        const date = parseDatePickerString(shareForm.expiresAt)
        return date ? date.toISOString() : null
      })(),
    }

    const response = await createShare(payload)
    lastShareUrl.value = response.share.url
    shareDialogVisible.value = false

    try {
      await navigator.clipboard?.writeText(response.share.url)
      ElMessage.success('Share created. Link copied to clipboard.')
    } catch {
      ElMessage.success('Share created. Copy the link below to share it.')
    }
  } catch (error) {
    if (error instanceof ApiError) {
      ElMessage.error(error.message)
    } else {
      console.error('Failed to create share', error)
      ElMessage.error('Unable to create share, please try again.')
    }
  } finally {
    shareSubmitting.value = false
  }
}
</script>

<template>
	<div class="page">
		<section class="intro">
			<div>
				<h1>Instant code diff</h1>
				<p class="subtitle">
					Paste two snippets to compare them side by side. Sign in to share and manage your diffs online.
				</p>
			</div>
			<el-button-group>
				<el-button @click="loadSamples">Load Sample</el-button>
				<el-button @click="swapContent">Swap Sides</el-button>
				<el-button type="warning" @click="clearContent">Clear Input</el-button>
			</el-button-group>
		</section>

		<el-row :gutter="16" class="editor-row">
			<el-col :span="24" :md="12">
				<el-card class="editor-card">
					<template #header><strong>Left source</strong></template>
					<el-input
						v-model="leftContent"
						:rows="12"
						class="editor-input"
						placeholder="Paste original code here..."
						resize="none"
						type="textarea"
					/>
				</el-card>
			</el-col>

			<el-col :span="24" :md="12">
				<el-card class="editor-card">
					<template #header><strong>Right source</strong></template>
					<el-input
						v-model="rightContent"
						:rows="12"
						class="editor-input"
						placeholder="Paste changed code here..."
						resize="none"
						type="textarea"
					/>
				</el-card>
			</el-col>
		</el-row>

		<el-card class="controls-card" shadow="never">
			<el-space :size="16" wrap>
				<el-radio-group size="small" v-model="mode">
					<el-radio-button :label="DiffModeEnum.Split">Split</el-radio-button>
					<el-radio-button :label="DiffModeEnum.Unified">Unified</el-radio-button>
				</el-radio-group>

				<el-switch
					v-model="fastDiffEnabled"
					active-text="Fast diff"
					inline-prompt
					inactive-text="Precise"
					size="large"
				/>
				<el-switch v-model="wrap" active-text="Wrap" inactive-text="No wrap" inline-prompt size="large" />
				<el-switch
					v-model="highlight"
					active-text="Highlight"
					inactive-text="Plain"
					inline-prompt
					size="large"
				/>

				<el-radio-group size="small" v-model="theme">
					<el-radio-button label="light">Light</el-radio-button>
					<el-radio-button label="dark">Dark</el-radio-button>
				</el-radio-group>

				<el-input-number size="small" v-model="fontSize" :min="12" :max="24" :step="1">
					<template #suffix><span>px</span></template>
				</el-input-number>

				<el-divider direction="vertical" />

				<template v-if="authStore.isAuthenticated">
					<el-button size="small" type="primary" :disabled="!hasDiff" @click="openShareDialog">
						Create share link
					</el-button>
				</template>
				<template v-else>
					<el-tooltip content="Sign in to generate share links">
						<span>
							<el-button disabled>Create share link</el-button>
						</span>
					</el-tooltip>
				</template>
			</el-space>
		</el-card>

		<el-card class="diff-card" shadow="never">
			<template #header>
				<div class="diff-header">
					<strong>Diff result</strong>
					<span v-if="!hasDiff" class="empty-hint">No differences detected yet</span>
				</div>
			</template>

			<div v-if="hasDiff" class="diff-wrapper">
				<DiffView
					:diff-file="diffFile!"
					:diff-view-font-size="fontSize"
					:diff-view-highlight="highlight"
					:diff-view-mode="mode"
					:diff-view-theme="theme"
					:diff-view-wrap="wrap"
				/>
			</div>
			<el-empty v-else description="Start typing to see the diff" />
		</el-card>

		<el-alert
			v-if="!authStore.isAuthenticated"
			type="info"
			title="Want to share diffs?"
			description="Create an account to save, hide, expire, and delete share links."
			show-icon
			class="share-hint"
		/>

		<el-alert
			v-if="lastShareUrl"
			type="success"
			show-icon
			title="Your share link is ready"
			class="share-result"
		>
			<template #default>
				<p>
					<el-link :href="lastShareUrl" target="_blank">{{ lastShareUrl }}</el-link>
				</p>
				<p class="share-note">It is already copied to your clipboard (if permissions allowed).</p>
			</template>
		</el-alert>

		<el-dialog v-model="shareDialogVisible" title="Create share link" width="460px">
			<el-form label-position="top">
				<el-form-item label="Title">
					<el-input v-model="shareForm.title" placeholder="Enter a title for this diff" />
				</el-form-item>

				<el-form-item label="Visibility">
					<el-switch
						v-model="shareForm.hidden"
						active-text="Hidden (only people with the link)"
						inactive-text="Listed"
						inline-prompt
					/>
				</el-form-item>

				<el-form-item label="Expiration (optional)">
					<el-date-picker
						v-model="shareForm.expiresAt"
						format="YYYY-MM-DD HH:mm:ss"
						type="datetime"
						value-format="YYYY-MM-DD HH:mm:ss"
						clearable
						placeholder="No expiration"
					/>
				</el-form-item>
			</el-form>

			<template #footer>
				<el-space>
					<el-button @click="shareDialogVisible = false">Cancel</el-button>
					<el-button :loading="shareSubmitting" type="primary" @click="submitShare">
						Create
					</el-button>
				</el-space>
			</template>
		</el-dialog>
	</div>
</template>

<style scoped>
.page {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.intro {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 12px;
}

.intro h1 {
	margin: 0 0 4px;
	font-size: 28px;
	font-weight: 600;
}

.subtitle {
	margin: 0;
	color: #6b7280;
	max-width: 540px;
}

.editor-row {
	margin-top: 4px;
}

.editor-card :deep(.el-card__body) {
	padding: 0;
}

.editor-input :deep(.el-textarea__inner) {
	min-height: 280px;
	border-radius: 0;
	font-family: Menlo, 'Fira Code', 'SFMono-Regular', Consolas, monospace;
	font-size: 14px;
}

.controls-card {
	padding: 4px 8px;
}

.controls-card ::v-deep(.el-card__body) {
	padding: 8px;
}
.diff-card :deep(.el-card__body) {
	padding: 0;
}

.diff-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.diff-wrapper {
	overflow: auto;
	max-height: 640px;
}

.empty-hint {
	color: #9ca3af;
	font-size: 14px;
	font-weight: 400;
}

.share-hint {
	margin-top: 8px;
}

.share-result {
	margin-top: 8px;
}

.share-result p {
	margin: 4px 0;
}

.share-note {
	color: #6b7280;
	font-size: 13px;
}

@media (max-width: 768px) {
	.diff-wrapper {
		max-height: none;
	}
}
</style>
