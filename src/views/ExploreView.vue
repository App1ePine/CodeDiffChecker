<script lang="ts" setup>
import { ElNotification } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listPublicShares } from '@/api/shares'
import type { PublicShareSummary } from '@/api/types'
import { ApiError } from '@/api/types'
import { formatLocalDateTime } from '@/utils/datetime'

const shares = ref<PublicShareSummary[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

onMounted(fetchShares)

async function fetchShares() {
  loading.value = true
  try {
    const response = await listPublicShares({ page: page.value, pageSize: pageSize.value })
    shares.value = response.shares
    total.value = response.pagination.total
  } catch (error) {
    if (error instanceof ApiError) {
      ElNotification.error({ message: error.message })
    } else {
      console.error('Failed to load public shares', error)
      ElNotification.error({ message: 'Failed to load public shares.' })
    }
  } finally {
    loading.value = false
  }
}

function handlePageChange(nextPage: number) {
  page.value = nextPage
  fetchShares()
}

function handlePageSizeChange(nextSize: number) {
  pageSize.value = nextSize
  page.value = 1
  fetchShares()
}

function formatDate(value: string | null) {
  return formatLocalDateTime(value)
}
</script>

<template>
	<div class="explore-page">
		<section class="hero">
			<div>
				<p class="eyebrow">Browse public diffs</p>
				<h1>Explore shared code comparisons</h1>
				<p class="lead">
					发现其他人公开的代码对比示例，快速打开链接并查看细节。
				</p>
			</div>
		</section>

		<el-card shadow="never">
			<template #header>
				<div class="card-header">
					<div>
						<strong>Latest public shares</strong>
						<p class="hint">仅展示未隐藏且未过期的分享。</p>
					</div>
					<div class="meta">
						<span>第 {{ page }} / {{ totalPages }} 页 · 共 {{ total }} 条</span>
						<el-button :loading="loading" size="small" plain @click="fetchShares">Refresh</el-button>
					</div>
				</div>
			</template>

			<el-skeleton :loading="loading" animated :rows="6">
				<template #default>
					<el-empty v-if="!shares.length" description="暂无公开分享" />

					<div v-else class="share-grid">
						<el-card
							v-for="share in shares"
							:key="share.slug"
							shadow="hover"
							class="share-card"
						>
							<div class="share-head">
								<h3 class="share-title">{{ share.title }}</h3>
								<el-tag v-if="share.expiresAt" size="small" type="warning">
									Expires {{ formatDate(share.expiresAt) }}
								</el-tag>
								<el-tag v-else size="small" type="success">No expiration</el-tag>
							</div>
							<p class="share-meta">
								Owner: {{ share.ownerName }} · Created {{ formatDate(share.createdAt) }}
							</p>

							<div class="share-actions">
								<RouterLink :to="{ name: 'share-viewer', params: { slug: share.slug } }">
									<el-button type="primary" plain>Open diff</el-button>
								</RouterLink>
								<el-link :href="`/shares/${share.slug}`" target="_blank" type="primary">
									Open in new tab
								</el-link>
							</div>
						</el-card>
					</div>

					<div v-if="shares.length" class="pagination-bar">
						<el-pagination
							:current-page="page"
							:page-size="pageSize"
							:page-sizes="[6, 12, 24]"
							:total="total"
							layout="prev, pager, next, sizes"
							@current-change="handlePageChange"
							@size-change="handlePageSizeChange"
						/>
					</div>
				</template>
			</el-skeleton>
		</el-card>
	</div>
</template>

<style scoped>
.explore-page {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.hero {
	padding: 20px 24px;
	border-radius: 16px;
	background: radial-gradient(circle at 20% 20%, #eef2ff, #fff), linear-gradient(120deg, #f8fafc, #eef2ff);
	border: 1px solid rgba(37, 99, 235, 0.12);
}

.eyebrow {
	margin: 0 0 6px;
	color: #4f46e5;
	font-weight: 600;
	letter-spacing: 0.02em;
	font-size: 13px;
	text-transform: uppercase;
}

.hero h1 {
	margin: 0 0 8px;
	font-size: 26px;
	font-weight: 700;
}

.lead {
	margin: 0;
	color: #4b5563;
	max-width: 640px;
}

.card-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	flex-wrap: wrap;
}

.hint {
	margin: 4px 0 0;
	color: #6b7280;
}

.meta {
	display: flex;
	align-items: center;
	gap: 12px;
	color: #6b7280;
}

.share-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	gap: 12px;
}

.share-card {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.share-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
}

.share-title {
	margin: 0;
	font-size: 18px;
}

.share-meta {
	margin: 0;
	color: #6b7280;
	font-size: 13px;
}

.share-actions {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-top: 4px;
}

.pagination-bar {
	display: flex;
	justify-content: center;
	margin-top: 16px;
}

@media (max-width: 640px) {
	.share-actions {
		flex-direction: column;
		align-items: flex-start;
	}
}
</style>
