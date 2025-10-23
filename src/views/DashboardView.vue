<script lang="ts" setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { deleteShare, listShares, updateShare } from '@/api/shares'
import type { ShareSummary } from '@/api/types'
import { ApiError } from '@/api/types'
import { formatLocalDateTime, parseDatePickerString, toDatePickerString } from '@/utils/datetime'

const shares = ref<ShareSummary[]>([])
const loading = ref(false)
const editDialogVisible = ref(false)
const editSubmitting = ref(false)
const editForm = reactive({
  id: 0,
  title: '',
  hidden: false,
  expiresAt: null as string | null,
})

const stats = computed(() => {
  const total = shares.value.length
  const hidden = shares.value.filter((share) => share.hidden).length
  const expired = shares.value.filter((share) => isExpired(share)).length
  return { total, hidden, expired }
})

onMounted(fetchShares)

async function fetchShares() {
  loading.value = true
  try {
    const response = await listShares()
    shares.value = response.shares
  } catch (error) {
    console.error('Failed to load shares', error)
    ElMessage.error('Unable to load shares right now.')
  } finally {
    loading.value = false
  }
}

function openEditDialog(share: ShareSummary) {
  editForm.id = share.id
  editForm.title = share.title
  editForm.hidden = share.hidden
  editForm.expiresAt = toDatePickerString(share.expiresAt)
  editDialogVisible.value = true
}

async function saveEdits() {
  if (!editForm.id) return
  editSubmitting.value = true
  try {
    const response = await updateShare(editForm.id, {
      title: editForm.title,
      hidden: editForm.hidden,
      expiresAt: fromDatePickerValue(editForm.expiresAt),
    })
    updateShareInList(response.share)
    editDialogVisible.value = false
    ElMessage.success('Share updated')
  } catch (error) {
    if (error instanceof ApiError) {
      ElMessage.error(error.message)
    } else {
      console.error('Failed to update share', error)
      ElMessage.error('Could not update share.')
    }
  } finally {
    editSubmitting.value = false
  }
}

async function toggleHidden(share: ShareSummary) {
  try {
    const response = await updateShare(share.id, {
      hidden: !share.hidden,
    })
    updateShareInList(response.share)
    ElMessage.success(response.share.hidden ? 'Share hidden' : 'Share visible')
  } catch (error) {
    if (error instanceof ApiError) {
      ElMessage.error(error.message)
    } else {
      console.error('Failed to toggle share', error)
      ElMessage.error('Unable to update visibility.')
    }
  }
}

async function removeShare(share: ShareSummary) {
  try {
    await ElMessageBox.confirm(`Delete share "${share.title}"? This cannot be undone.`, 'Delete share', {
      type: 'warning',
      confirmButtonText: 'Delete',
    })
  } catch {
    return
  }

  try {
    await deleteShare(share.id)
    shares.value = shares.value.filter((item) => item.id !== share.id)
    ElMessage.success('Share deleted')
  } catch (error) {
    if (error instanceof ApiError) {
      ElMessage.error(error.message)
    } else {
      console.error('Failed to delete share', error)
      ElMessage.error('Unable to delete share.')
    }
  }
}

async function copyLink(share: ShareSummary) {
  try {
    await navigator.clipboard?.writeText(share.url)
    ElMessage.success('Link copied to clipboard')
  } catch (error) {
    console.error('Copy failed', error)
    ElMessage.error('Copy failed. Please copy the link manually.')
  }
}

function isExpired(share: ShareSummary) {
  if (!share.expiresAt) return false
  return new Date(share.expiresAt).getTime() < Date.now()
}

function fromDatePickerValue(value: string | null) {
  const date = parseDatePickerString(value)
  if (!date) return null
  return date.toISOString()
}

function updateShareInList(updated: ShareSummary) {
  const index = shares.value.findIndex((item) => item.id === updated.id)
  if (index >= 0) {
    shares.value.splice(index, 1, updated)
  }
}

function formatDate(value: string | null) {
  return formatLocalDateTime(value)
}
</script>

<template>
	<div class="dashboard">
		<section class="overview">
			<div>
				<h2>My share links</h2>
				<p class="subtitle">
					Manage visibility, set expiration dates, or remove old links.
				</p>
			</div>
			<div class="stat-cards">
				<el-card class="stat-card" shadow="hover">
					<span class="stat-value">{{ stats.total }}</span>
					<span class="stat-label">Total</span>
				</el-card>
				<el-card class="stat-card" shadow="hover">
					<span class="stat-value">{{ stats.hidden }}</span>
					<span class="stat-label">Hidden</span>
				</el-card>
				<el-card class="stat-card" shadow="hover">
					<span class="stat-value">{{ stats.expired }}</span>
					<span class="stat-label">Expired</span>
				</el-card>
			</div>
		</section>

		<el-card shadow="never">
			<template #header>
				<div class="table-header">
					<span>Recent shares</span>
					<el-button :loading="loading" plain size="small" @click="fetchShares">
						Refresh
					</el-button>
				</div>
			</template>

			<el-table :data="shares" :loading="loading" empty-text="No shares created yet" style="width: 100%">
				<el-table-column label="Title" min-width="220">
					<template #default="{ row }">
						<div class="title-cell">
							<span>{{ row.title }}</span>
							<el-tag v-if="row.hidden" size="small" type="info">Hidden</el-tag>
							<el-tag v-if="isExpired(row)" size="small" type="danger">Expired</el-tag>
						</div>
						<el-link :href="row.url" target="_blank">{{ row.url }}</el-link>
					</template>
				</el-table-column>

				<el-table-column label="Expires" min-width="160">
					<template #default="{ row }">{{ formatDate(row.expiresAt) }}</template>
				</el-table-column>

				<el-table-column label="Updated" min-width="160">
					<template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
				</el-table-column>

				<el-table-column align="right" label="Actions" min-width="240">
					<template #default="{ row }">
						<el-button-group>
							<el-button size="small" @click="copyLink(row)">Copy</el-button>
							<el-button size="small" type="primary" @click="openEditDialog(row)">Edit</el-button>
							<el-button size="small" type="info" @click="toggleHidden(row)">
								{{ row.hidden ? 'Unhide' : 'Hide' }}
							</el-button>
							<el-button size="small" type="danger" @click="removeShare(row)">Delete</el-button>
						</el-button-group>
					</template>
				</el-table-column>
			</el-table>
		</el-card>

		<el-dialog v-model="editDialogVisible" title="Edit share" width="460px">
			<el-form label-position="top">
				<el-form-item label="Title">
					<el-input v-model="editForm.title" />
				</el-form-item>
				<el-form-item label="Visibility">
					<el-switch
						v-model="editForm.hidden"
						active-text="Hidden"
						inactive-text="Visible"
						inline-prompt
					/>
				</el-form-item>
				<el-form-item label="Expiration">
					<el-date-picker
						v-model="editForm.expiresAt"
						format="YYYY-MM-DD HH:mm:ss"
						type="datetime"
						value-format="YYYY-MM-DD HH:mm:ss"
						clearable
						placeholder="Never"
					/>
				</el-form-item>
			</el-form>
			<template #footer>
				<el-space>
					<el-button @click="editDialogVisible = false">Cancel</el-button>
					<el-button :loading="editSubmitting" type="primary" @click="saveEdits">Save</el-button>
				</el-space>
			</template>
		</el-dialog>
	</div>
</template>

<style scoped>
.dashboard {
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.overview {
	display: flex;
	justify-content: space-between;
	gap: 24px;
	flex-wrap: wrap;
	align-items: center;
}

.subtitle {
	margin: 4px 0 0;
	color: #6b7280;
}

.stat-cards {
	display: flex;
	gap: 12px;
	flex-wrap: wrap;
}

.stat-card {
	width: 120px;
	text-align: center;
}

.stat-value {
	display: block;
	font-size: 24px;
	font-weight: 600;
}

.stat-label {
	display: block;
	color: #6b7280;
}

.table-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.title-cell {
	display: flex;
	gap: 6px;
	align-items: center;
	flex-wrap: wrap;
}

@media (max-width: 768px) {
	.overview {
		flex-direction: column;
		align-items: flex-start;
	}

	.stat-card {
		width: auto;
		min-width: 100px;
	}
}
</style>
