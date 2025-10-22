<script setup lang="ts">
import type { AxiosError } from 'axios'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import http from '../services/http'
import { type AuthUser, useAuthStore } from '../stores/auth'

type LoginForm = {
  email: string
  password: string
}

type LoginResponse = {
  token: string
  user?: AuthUser | null
}

const router = useRouter()
const route = useRoute()
const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive<LoginForm>({
  email: '',
  password: '',
})

const rules: FormRules<LoginForm> = {
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'change'] },
  ],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const auth = useAuthStore()

const getErrorMessage = (error: unknown) => {
  const axiosError = error as AxiosError<{ message?: string }>
  return axiosError.response?.data?.message ?? axiosError.message ?? '登录失败，请稍后重试'
}

const redirectAfterLogin = () => {
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
    const { data } = await http.post<LoginResponse>('/auth/login', form)
    if (!data?.token) {
      throw new Error('未能获取登录凭据')
    }
    auth.setAuth(data.token, data.user ?? null)
    ElMessage.success('登录成功')
    redirectAfterLogin()
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
        <h2 class="card-title">登录</h2>
      </template>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" @submit.prevent>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" autocomplete="email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" autocomplete="current-password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item>
          <el-button :loading="loading" style="width: 100%" type="primary" @click="handleSubmit">
            登录
          </el-button>
        </el-form-item>
        <div class="switch-link">
          还没有账号？
          <RouterLink :to="{ name: 'register' }">立即注册</RouterLink>
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
  max-width: 420px;
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
