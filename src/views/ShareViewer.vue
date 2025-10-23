<script lang="ts" setup>
import type { DiffFile } from '@git-diff-view/file'
import { generateDiffFile } from '@git-diff-view/file'
import { DiffModeEnum, DiffView, setEnableFastDiffTemplate } from '@git-diff-view/vue'
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { fetchShareBySlug } from '@/api/shares'
import type { ShareDetail } from '@/api/types'
import { ApiError } from '@/api/types'
import { formatLocalDateTime } from '@/utils/datetime'

const route = useRoute()

const loading = ref(true)
const errorMessage = ref('')
const share = ref<ShareDetail | null>(null)
const mode = ref<DiffModeEnum>(DiffModeEnum.Split)
const wrap = ref(true)
const highlight = ref(true)
const theme = ref<'light' | 'dark'>('light')
const fontSize = ref(14)
const fastDiffEnabled = ref(true)

const diffFile = computed<DiffFile | null>(() => {
  if (!share.value) return null
  setEnableFastDiffTemplate(fastDiffEnabled.value)
  const diff = generateDiffFile('left', share.value.leftContent, 'right', share.value.rightContent, '', '', {})
  diff.initTheme(theme.value)
  diff.init()
  diff.buildSplitDiffLines()
  diff.buildUnifiedDiffLines()
  return diff
})

const pageTitle = computed(() => share.value?.title ?? 'Share')

onMounted(loadShare)

watch(
  () => route.params.slug,
  () => {
    loadShare()
  }
)

watchEffect(() => {
  document.title = `Code Diff Checker - ${pageTitle.value}`
})

async function loadShare() {
  const slug = String(route.params.slug ?? '')
  if (!slug) {
    errorMessage.value = 'Missing share identifier.'
    loading.value = false
    return
  }

  loading.value = true
  errorMessage.value = ''
  share.value = null

  try {
    const response = await fetchShareBySlug(slug)
    share.value = response.share
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        errorMessage.value = 'This share does not exist or is hidden.'
      } else if (error.status === 410) {
        errorMessage.value = 'This share has expired.'
      } else {
        errorMessage.value = error.message
      }
    } else {
      console.error('Failed to load shared diff', error)
      errorMessage.value = 'Failed to load the shared diff. Please try again later.'
    }
  } finally {
    loading.value = false
  }
}

function formatDate(value: string | null) {
  return formatLocalDateTime(value)
}
</script>

<template>
	<div class="share-viewer">
		<el-card shadow="never">
			<template #header>
				<div class="header">
					<div>
						<h2 class="title">{{ pageTitle }}</h2>
						<p v-if="share" class="meta">
							Shared by <strong>{{ share.ownerName }}</strong>
							- Created {{ formatDate(share.createdAt) }}
							- Expires {{ formatDate(share.expiresAt) }}
						</p>
					</div>
					<div v-if="share" class="controls">
						<el-switch size="large" v-model="fastDiffEnabled" active-text="Fast diff" inline-prompt inactive-text="Precise" />
						<el-switch size="large" v-model="wrap" active-text="Wrap" inline-prompt inactive-text="No wrap" />
						<el-switch size="large" v-model="highlight" active-text="Highlight" inline-prompt inactive-text="Plain" />
						<el-radio-group size="small" v-model="theme">
							<el-radio-button label="light">Light</el-radio-button>
							<el-radio-button label="dark">Dark</el-radio-button>
						</el-radio-group>
						<el-input-number size="small" v-model="fontSize" :min="12" :max="22" :step="1">
							<template #suffix>px</template>
						</el-input-number>
					</div>
				</div>
			</template>

			<el-skeleton :loading="loading" :rows="6" animated>
				<template #default>
					<el-alert
						v-if="errorMessage"
						:title="errorMessage"
						class="error-alert"
						show-icon
						type="error"
					/>

					<template v-else-if="share && diffFile">
						<div class="diff-wrapper">
							<DiffView
								:diff-file="diffFile"
								:diff-view-font-size="fontSize"
								:diff-view-highlight="highlight"
								:diff-view-mode="mode"
								:diff-view-theme="theme"
								:diff-view-wrap="wrap"
							/>
						</div>
					</template>

					<el-empty v-else description="Nothing to display" />
				</template>
			</el-skeleton>
		</el-card>

		<el-card v-if="share" class="share-summary" shadow="never">
			<template #header>
				<strong>Summary</strong>
			</template>
			<el-descriptions :column="1" border>
				<el-descriptions-item label="Title">{{ share.title }}</el-descriptions-item>
				<el-descriptions-item label="Owner">{{ share.ownerName }}</el-descriptions-item>
				<el-descriptions-item label="Created at">{{ formatDate(share.createdAt) }}</el-descriptions-item>
				<el-descriptions-item label="Expires on">{{ formatDate(share.expiresAt) }}</el-descriptions-item>
			</el-descriptions>
		</el-card>
	</div>
</template>

<style scoped>
.share-viewer {
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 16px;
	flex-wrap: wrap;
}

.title {
	margin: 0;
}

.meta {
	margin: 4px 0 0;
	color: #6b7280;
}

.controls {
	display: flex;
	gap: 12px;
	align-items: center;
	flex-wrap: wrap;
}

.diff-wrapper {
	overflow: auto;
}

.error-alert {
	margin-bottom: 16px;
}

.share-summary :deep(.el-descriptions__label) {
	width: 160px;
}

@media (max-width: 768px) {
	.controls {
		width: 100%;
		justify-content: flex-start;
	}
}
</style>
