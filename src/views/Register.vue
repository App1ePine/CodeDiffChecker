<script setup lang="ts">
import type { AxiosError } from 'axios'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '../services/http'
import { type AuthUser, useAuthStore } from '../stores/auth'

type RegisterForm = {
  email: string
  password: string
  confirmPassword: string
}

type RegisterResponse = {
  token: string
  user?: AuthUser | null
}

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive<RegisterForm>({
  email: '',
  password: '',
  confirmPassword: '',
})

const rules: FormRules<RegisterForm> = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'change'] },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码长度不少于 8 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (!value) {
          callback(new Error('请再次输入密码'))
        } else if (value !== form.password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: ['blur', 'change'],
    },
  ],
}

const auth = useAuthStore()

const getErrorMessage = (error: unknown) => {
  const axiosError = error as AxiosError<{ message?: string }>
  return axiosError.response?.data?.message ?? axiosError.message ?? '注册失败，请稍后重试'
}

const redirectAfterRegister = () => {
  const redirect = route.query.redirect as string | undefined
  if (redirect) {
    router.replace(redirect)
  } else {
    router.replace({ name: 'editor' })
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    loading.value = true
    await formRef.value.validate()
    const payload = {
      email: form.email,
      password: form.password,
    }
    const { data } = await http.post<RegisterResponse>('/auth/register', payload)
    if (!data?.token) {
      throw new Error('未能获取注册凭据')
    }
    auth.setAuth(
      data.token,
      data.user ?? {
        id: 0,
        email: form.email,
      },
    )
    ElMessage.success('注册成功，已自动登录')
    redirectAfterRegister()
  } catch (error) {
    ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <el-card class="auth-card">
      <template #header>
        <h2 class="card-title">注册</h2>
      </template>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" @submit.prevent>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" autocomplete="email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" autocomplete="new-password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" autocomplete="new-password" placeholder="请再次输入密码" show-password />
        </el-form-item>
        <el-form-item>
          <el-button :loading="loading" style="width: 100%" type="primary" @click="handleSubmit">
            注册
          </el-button>
        </el-form-item>
        <div class="switch-link">
          已有账号？
          <RouterLink :to="{ name: 'login' }">前往登录</RouterLink>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.auth-page {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 16px;
}

.auth-card {
  width: 100%;
  max-width: 460px;
}

.card-title {
  margin: 0;
  text-align: center;
}

.switch-link {
  text-align: right;
  font-size: 14px;
}

.switch-link a {
  margin-left: 4px;
}
</style>
