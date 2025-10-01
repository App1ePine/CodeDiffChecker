<script setup lang="ts">
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
</script>

<template>
	<div class="app-container">
		<el-container>
			<el-header height="auto" class="app-header">
				<h1>Code Diff Checker</h1>
				<p class="subtitle">基于 git-diff-view 的代码差异对比工具</p>
			</el-header>

			<el-main>
				<el-row :gutter="16" class="editor-row">
					<el-col :span="12">
						<el-card class="editor-card">
							<template #header>
								<div class="card-header"><span>Left</span></div>
							</template>
							<el-input
								v-model="leftContent"
								type="textarea"
								resize="none"
								:rows="15"
								class="input-area"
								placeholder="Please input old code text."
							/>
						</el-card>
					</el-col>

					<el-col :span="12">
						<el-card class="editor-card">
							<template #header>
								<div class="card-header"><span>Right</span></div>
							</template>
							<el-input
								v-model="rightContent"
								type="textarea"
								resize="none"
								:rows="15"
								class="input-area"
								placeholder="Please input new code text."
							/>
						</el-card>
					</el-col>
				</el-row>

				<el-card class="control-card">
					<el-space wrap :size="20">
						<el-radio-group v-model="mode">
							<el-radio-button :label="DiffModeEnum.Split">Split</el-radio-button>
							<el-radio-button :label="DiffModeEnum.Unified">Unified</el-radio-button>
						</el-radio-group>

						<el-switch
							v-model="fastDiffEnabled"
							size="large"
							inline-prompt
							active-text="Enable FastDiff"
							inactive-text="Disable FastDiff"
							style="--el-switch-off-color: #ff4949"
						/>
						<el-switch
							v-model="wrap"
							size="large"
							inline-prompt
							active-text="Enable Wrap"
							inactive-text="Disable Wrap"
							style="--el-switch-off-color: #ff4949"
						/>
						<el-switch
							v-model="highlight"
							size="large"
							inline-prompt
							active-text="Enable Highlight"
							inactive-text="Disable Highlight"
							style="--el-switch-off-color: #ff4949"
						/>

						<el-radio-group v-model="theme" >
							<el-radio-button label="light">Light</el-radio-button>
							<el-radio-button label="dark">Dark</el-radio-button>
						</el-radio-group>


						<el-input-number v-model="fontSize" :min="14" :max="24" :step="2" >
							<template #suffix>
								<span>px</span>
							</template>
						</el-input-number>

						<el-button type="info" plain @click="handleSwapContent">SwapSide</el-button>
						<el-button type="warning" plain @click="handleClearInput">ClearInput</el-button>
					</el-space>
				</el-card>

				<el-card shadow="never" class="diff-card">
					<template #header>
						<div class="card-header"><span>差异结果</span></div>
					</template>

					<div v-if="diffFile" class="diff-wrapper">
						<DiffView
							:diff-file="diffFile"
							:diff-view-mode="mode"
							:diff-view-wrap="wrap"
							:diff-view-highlight="highlight"
							:diff-view-font-size="fontSize"
							:diff-view-theme="theme"
						/>
					</div>
					<el-empty v-else description="未检测到差异" />
				</el-card>
			</el-main>
		</el-container>
	</div>
</template>

<style scoped>
.app-container {
	background-color: #f5f6fb;
}
.app-header {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	padding: 0 0;
}
.app-header h1 {
	font-size: 32px;
	font-weight: 600;
}
.subtitle {
	margin: 0;
	color: #6b7280;
	font-size: 14px;
}
.editor-row {
	margin-bottom: 16px;
}
.editor-card :deep(.el-card__header) {
	padding: 8px;
}
.editor-card :deep(.el-card__body) {
	padding: 0;
}
.editor-card :deep(.el-textarea__inner) {
	border-radius: 0;
	font-family: 'FiraCode Nerd Font', 'FiraCode', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
	font-size: 14px;
	line-height: 1.5;
}
.control-card {
	margin-bottom: 16px;
}
.card-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 22px;
	font-weight: 500;
	padding: 0;
}
.diff-card :deep(.el-card__body) {
	padding: 16px;
}
.diff-wrapper {
	overflow: auto;
}
</style>
