<script setup lang="ts">
import type { AxiosError } from 'axios'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '../services/http'

type PasteSummary = {
  slug: string
  title?: string
  createdAt?: string
  updatedAt?: string
}

const router = useRouter()
const loading = ref(false)
const pastes = ref<PasteSummary[]>([])
const errorMessage = ref('')

const fetchPastes = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await http.get<PasteSummary[]>('/pastes/mine')
    pastes.value = Array.isArray(data) ? data : []
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>
    errorMessage.value = axiosError.response?.data?.message ?? axiosError.message ?? '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const handleView = (slug: string) => {
  router.push({ name: 'pasteViewer', params: { slug } })
}

const handleEdit = (slug: string) => {
  router.push({ name: 'pasteEdit', params: { slug } })
}

onMounted(fetchPastes)
</script>

<template>
  <div class="my-pastes" v-loading="loading">
    <div class="page-header">
      <div>
        <h2>我的 Paste</h2>
        <p class="subtitle">管理你保存的所有差异记录</p>
      </div>
      <el-button type="primary" @click="router.push({ name: 'editor' })">新建 Paste</el-button>
    </div>

    <el-alert
      v-if="errorMessage"
      :closable="false"
      show-icon
      title="加载失败"
      type="error"
      :description="errorMessage"
      class="error-alert"
    />

    <el-empty v-else-if="!pastes.length" description="暂时没有保存的 Paste" />

    <el-table v-else :data="pastes" border stripe>
      <el-table-column label="标题" prop="title">
        <template #default="{ row }">
          {{ row.title || `Paste ${row.slug}` }}
        </template>
      </el-table-column>
      <el-table-column label="Slug" prop="slug" width="220" />
      <el-table-column label="更新时间" prop="updatedAt" width="180">
        <template #default="{ row }">
          {{ row.updatedAt || row.createdAt || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-space>
            <el-button size="small" type="primary" @click="handleView(row.slug)">查看</el-button>
            <el-button size="small" @click="handleEdit(row.slug)">编辑</el-button>
          </el-space>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.my-pastes {
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

.subtitle {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 14px;
}

.error-alert {
  margin-bottom: 8px;
}
</style>
