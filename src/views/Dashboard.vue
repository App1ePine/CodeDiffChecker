<script lang="ts" setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { deletePaste, fetchPastes, type PasteSummaryWithUrl, updatePaste } from '../api/pastes'

const router = useRouter()
const loading = ref(false)
const pastes = ref<PasteSummaryWithUrl[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const hasNext = ref(false)
const visibilityFilter = ref<'all' | 'public' | 'unlisted' | 'private'>('all')
const statusFilter = ref<'all' | 'active' | 'expired'>('all')

const copyDisabled = computed(() => typeof navigator === 'undefined' || !navigator.clipboard)

const visibilityTextMap: Record<PasteSummaryWithUrl['visibility'], string> = {
  public: '公开',
  unlisted: '仅持有链接',
  private: '仅自己',
}

const visibilityTagMap: Record<PasteSummaryWithUrl['visibility'], 'success' | 'info' | 'warning'> = {
  public: 'success',
  unlisted: 'info',
  private: 'warning',
}

const resetToFirstPage = () => {
  page.value = 1
}

watch([visibilityFilter, statusFilter], resetToFirstPage)

const loadData = async () => {
  loading.value = true
  try {
    const response = await fetchPastes({
      page: page.value,
      pageSize: pageSize.value,
      visibility: visibilityFilter.value === 'all' ? undefined : visibilityFilter.value,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value,
    })
    pastes.value = response.items
    total.value = response.total
    hasNext.value = response.hasNext
  } catch (error) {
    console.error(error)
    ElMessage.error((error as Error).message ?? '加载 Paste 列表失败')
  } finally {
    loading.value = false
  }
}

watch(
  [page, pageSize, visibilityFilter, statusFilter],
  () => {
    void loadData()
  },
  { immediate: true }
)

const handleSizeChange = (value: number) => {
  pageSize.value = value
  page.value = 1
}

const handleCurrentChange = (value: number) => {
  page.value = value
}

const handleCreate = () => {
  router.push('/pastes/new')
}

const handleEdit = (row: PasteSummaryWithUrl) => {
  router.push(`/pastes/${row.id}/edit`)
}

const handleToggleVisibility = async (row: PasteSummaryWithUrl) => {
  const order: PasteSummaryWithUrl['visibility'][] = ['public', 'unlisted', 'private']
  const currentIndex = order.indexOf(row.visibility)
  const nextVisibility = order[(currentIndex + 1) % order.length]
  try {
    await updatePaste(row.id, { visibility: nextVisibility })
    ElMessage.success('可见性已更新')
    await loadData()
  } catch (error) {
    console.error(error)
    ElMessage.error((error as Error).message ?? '更新可见性失败')
  }
}

const handleCopyLink = async (row: PasteSummaryWithUrl) => {
  if (copyDisabled.value) {
    ElMessage.warning('当前环境不支持一键复制，请手动复制链接')
    return
  }
  try {
    await navigator.clipboard.writeText(row.shareUrl)
    ElMessage.success('分享链接已复制到剪贴板')
  } catch (error) {
    console.error(error)
    ElMessage.error('复制链接失败，请重试')
  }
}

const handleDelete = async (row: PasteSummaryWithUrl) => {
  try {
    await ElMessageBox.confirm(`确认删除「${row.title}」吗？此操作不可撤销。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deletePaste(row.id)
    ElMessage.success('Paste 已删除')
    if (pastes.value.length === 1 && page.value > 1) {
      page.value -= 1
    }
    await loadData()
  } catch (error) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    console.error(error)
    ElMessage.error('删除失败，请稍后再试')
  }
}

const formatExpiresAt = (expiresAt: string | null, expired: boolean) => {
  if (!expiresAt) return '永久有效'
  const date = new Date(expiresAt)
  const formatted = Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString()
  return expired ? `${formatted}（已过期）` : formatted
}
</script>

<template>
  <div class="dashboard">
    <div class="dashboard__header">
      <div>
        <h2 class="dashboard__title">我的 Paste</h2>
        <p class="dashboard__description">查看、分享并管理已经创建的代码片段</p>
      </div>
      <el-button type="primary" @click="handleCreate">新建 Paste</el-button>
    </div>

    <el-card class="dashboard__card" shadow="never">
      <template #header>
        <div class="dashboard__filters">
          <el-space wrap size="small">
            <span class="dashboard__filter-label">可见性</span>
            <el-select v-model="visibilityFilter" size="small" style="width: 140px">
              <el-option label="全部" value="all" />
              <el-option label="公开" value="public" />
              <el-option label="仅持有链接" value="unlisted" />
              <el-option label="仅自己" value="private" />
            </el-select>
            <span class="dashboard__filter-label">状态</span>
            <el-select v-model="statusFilter" size="small" style="width: 140px">
              <el-option label="全部" value="all" />
              <el-option label="有效" value="active" />
              <el-option label="已过期" value="expired" />
            </el-select>
          </el-space>
        </div>
      </template>

      <el-table :data="pastes" border stripe v-loading="loading" class="dashboard__table" empty-text="暂无 Paste">
        <el-table-column label="标题" min-width="220">
          <template #default="{ row }">
            <div class="dashboard__title-cell">
              <span class="dashboard__row-title">{{ row.title }}</span>
              <el-tag v-if="row.expired" type="danger" size="small">已过期</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="可见性" width="140">
          <template #default="{ row }">
            <el-tag :type="visibilityTagMap[row.visibility]" size="small">
              {{ visibilityTextMap[row.visibility] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="过期时间" min-width="200">
          <template #default="{ row }">
            {{ formatExpiresAt(row.expiresAt, row.expired) }}
          </template>
        </el-table-column>
        <el-table-column label="分享链接" min-width="260">
          <template #default="{ row }">
            <el-tooltip :content="row.shareUrl" placement="top">
              <span class="dashboard__share-url">{{ row.shareUrl }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320">
          <template #default="{ row }">
            <el-space wrap>
              <el-button size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button size="small" @click="handleToggleVisibility(row)">切换可见性</el-button>
              <el-button :disabled="copyDisabled" size="small" @click="handleCopyLink(row)">复制链接</el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
            </el-space>
          </template>
        </el-table-column>
      </el-table>

      <div class="dashboard__pagination" v-if="total > 0 || hasNext">
        <el-pagination
          :current-page="page"
          :page-size="pageSize"
          :page-sizes="[5, 10, 20, 50]"
          :total="total"
          background
          layout="total, sizes, prev, pager, next"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dashboard__title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #111827;
}

.dashboard__description {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.dashboard__card {
  border: none;
  border-radius: 12px;
}

.dashboard__filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dashboard__filter-label {
  color: #6b7280;
  font-size: 13px;
}

.dashboard__table {
  margin-top: 8px;
}

.dashboard__title-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dashboard__row-title {
  font-weight: 500;
  color: #111827;
}

.dashboard__share-url {
  display: inline-block;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #2563eb;
}

.dashboard__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
