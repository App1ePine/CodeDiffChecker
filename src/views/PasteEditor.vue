<script lang="ts" setup>
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createPaste, getPaste, updatePaste } from '../api/pastes'

type VisibilityOption = 'public' | 'unlisted' | 'private'
type ExpirationOption = '1d' | '7d' | 'forever' | 'custom'

interface FormState {
  title: string
  content: string
  visibility: VisibilityOption
  expiration: ExpirationOption
}

const router = useRouter()
const route = useRoute()

const pasteId = computed(() => (typeof route.params.id === 'string' ? route.params.id : undefined))
const isEdit = computed(() => Boolean(pasteId.value))

const loading = ref(false)
const submitting = ref(false)
const copyDisabled = computed(() => typeof navigator === 'undefined' || !navigator.clipboard)

const form = reactive<FormState>({
  title: '',
  content: '',
  visibility: 'public',
  expiration: '7d',
})

const existingExpiresAt = ref<string | null>(null)
const existingShareUrl = ref<string>('')

const matchExpirationOption = (expiresAt: string | null): ExpirationOption => {
  if (!expiresAt) return 'forever'
  const target = new Date(expiresAt)
  if (Number.isNaN(target.getTime())) return 'custom'
  const now = Date.now()
  const diff = target.getTime() - now
  const dayMs = 24 * 60 * 60 * 1000
  if (Math.abs(diff - dayMs) <= dayMs * 0.5) return '1d'
  if (Math.abs(diff - 7 * dayMs) <= 7 * dayMs * 0.5) return '7d'
  return 'custom'
}

const showCustomOption = computed(
  () => isEdit.value && !!existingExpiresAt.value && matchExpirationOption(existingExpiresAt.value) === 'custom'
)

const customExpirationLabel = computed(() => {
  if (!existingExpiresAt.value) return '保留当前设置'
  const date = new Date(existingExpiresAt.value)
  if (Number.isNaN(date.getTime())) return '保留当前设置'
  return `保留当前设置（到期：${date.toLocaleString()}）`
})

const computeExpiresAtValue = (option: ExpirationOption) => {
  const dayMs = 24 * 60 * 60 * 1000
  switch (option) {
    case '1d':
      return new Date(Date.now() + dayMs).toISOString()
    case '7d':
      return new Date(Date.now() + 7 * dayMs).toISOString()
    case 'forever':
      return null
    case 'custom':
      return existingExpiresAt.value
    default:
      return null
  }
}

const expiresAtPreview = computed(() => {
  const value = computeExpiresAtValue(form.expiration)
  if (!value) return '永久有效'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString()
})

const handleLoad = async (id: string) => {
  loading.value = true
  try {
    const data = await getPaste(id)
    form.title = data.title
    form.content = data.content ?? ''
    form.visibility = data.visibility
    existingExpiresAt.value = data.expiresAt ?? null
    existingShareUrl.value = data.shareUrl ?? ''
    form.expiration = matchExpirationOption(data.expiresAt ?? null)
  } catch (error) {
    console.error(error)
    ElMessage.error((error as Error).message ?? '获取 Paste 信息失败')
    router.push('/dashboard')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (pasteId.value) {
    void handleLoad(pasteId.value)
  }
})

const handleSubmit = async () => {
  if (!form.title.trim()) {
    ElMessage.warning('请输入标题')
    return
  }
  if (!form.content.trim()) {
    ElMessage.warning('请输入内容')
    return
  }

  submitting.value = true
  try {
    const payload = {
      title: form.title,
      content: form.content,
      visibility: form.visibility,
      expiresAt: computeExpiresAtValue(form.expiration),
    }

    if (isEdit.value && pasteId.value) {
      await updatePaste(pasteId.value, payload)
      ElMessage.success('Paste 已更新')
    } else {
      await createPaste(payload)
      ElMessage.success('Paste 已创建')
    }

    router.push('/dashboard')
  } catch (error) {
    console.error(error)
    ElMessage.error((error as Error).message ?? '保存失败，请稍后再试')
  } finally {
    submitting.value = false
  }
}

const handleCancel = () => {
  router.back()
}

const handleCopyShare = async () => {
  if (copyDisabled.value) {
    ElMessage.warning('当前环境不支持一键复制，请手动复制链接')
    return
  }
  try {
    await navigator.clipboard.writeText(existingShareUrl.value)
    ElMessage.success('链接已复制')
  } catch (error) {
    console.error(error)
    ElMessage.error('复制失败，请稍后再试')
  }
}
</script>

<template>
  <div class="editor">
    <el-card v-loading="loading" class="editor__card" shadow="never">
      <template #header>
        <div class="editor__header">
          <h2>{{ isEdit ? '编辑 Paste' : '新建 Paste' }}</h2>
          <p>设置标题、内容以及访问策略，方便分享或自留</p>
        </div>
      </template>

      <el-form label-position="top" class="editor__form">
        <el-form-item label="标题">
          <el-input v-model="form.title" maxlength="60" placeholder="请输入 Paste 标题" show-word-limit />
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="form.content"
            :rows="14"
            placeholder="粘贴代码或文本内容"
            resize="none"
            type="textarea"
          />
        </el-form-item>
        <el-form-item label="访问权限">
          <el-radio-group v-model="form.visibility">
            <el-radio-button label="public">公开</el-radio-button>
            <el-radio-button label="unlisted">仅持有链接</el-radio-button>
            <el-radio-button label="private">仅自己</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="过期时间">
          <div class="editor__expiration">
            <el-radio-group v-model="form.expiration">
              <el-radio-button label="1d">1 天</el-radio-button>
              <el-radio-button label="7d">7 天</el-radio-button>
              <el-radio-button label="forever">永久</el-radio-button>
              <el-radio-button v-if="showCustomOption" label="custom">{{ customExpirationLabel }}</el-radio-button>
            </el-radio-group>
            <p class="editor__hint">预计在 {{ expiresAtPreview }} 到期</p>
          </div>
        </el-form-item>
      </el-form>

      <div class="editor__actions">
        <el-button @click="handleCancel">取消</el-button>
        <el-button :loading="submitting" type="primary" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '创建 Paste' }}
        </el-button>
      </div>
    </el-card>

    <el-card v-if="isEdit && existingShareUrl" class="editor__share" shadow="never">
      <template #header>
        <span>分享信息</span>
      </template>
      <p class="editor__share-tip">链接将遵循当前的访问权限与过期时间设置。</p>
      <div class="editor__share-row">
        <el-input :model-value="existingShareUrl" readonly />
        <el-button :disabled="copyDisabled" @click="handleCopyShare">复制链接</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor__card,
.editor__share {
  border: none;
  border-radius: 12px;
}

.editor__header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #111827;
}

.editor__header p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.editor__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor__expiration {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editor__hint {
  margin: 0;
  color: #6b7280;
  font-size: 12px;
}

.editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.editor__share-tip {
  margin: 0 0 12px;
  color: #6b7280;
  font-size: 13px;
}

.editor__share-row {
  display: flex;
  gap: 8px;
}

.editor__share-row .el-input {
  flex: 1;
}
</style>
