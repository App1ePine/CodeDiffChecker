<script lang="ts" setup>
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/types'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref<FormInstance | null>(null)
const submitting = ref(false)

const usernamePattern = /^[a-zA-Z0-9_]+$/

const form = reactive({
  username: '',
  nickname: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const rules: FormRules = {
  username: [
    { required: true, message: 'Username is required', trigger: 'blur' },
    { min: 3, message: 'Username should be at least 3 characters', trigger: 'blur' },
    { max: 12, message: 'Username cannot exceed 12 characters', trigger: 'blur' },
    {
      pattern: usernamePattern,
      message: 'Username may only contain letters, numbers, and underscores',
      trigger: 'blur',
    },
  ],
  nickname: [
    { required: true, message: 'Nickname is required', trigger: 'blur' },
    { min: 2, message: 'Nickname should be at least 2 characters', trigger: 'blur' },
    { max: 24, message: 'Nickname cannot exceed 24 characters', trigger: 'blur' },
  ],
  email: [
    { required: true, message: 'Email is required', trigger: 'blur' },
    { type: 'email', message: 'Please enter a valid email address', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Password is required', trigger: 'blur' },
    { min: 6, message: 'Password must be at least 6 characters', trigger: 'blur' },
    { max: 24, message: 'Password cannot exceed 24 characters', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: 'Please confirm your password', trigger: 'blur' },
    { min: 6, message: 'Password must be at least 6 characters', trigger: 'blur' },
    { max: 24, message: 'Password cannot exceed 24 characters', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (!value) {
          callback()
          return
        }
        if (value !== form.password) {
          callback(new Error('Passwords do not match'))
        } else {
          callback()
        }
      },
      trigger: ['blur', 'change'],
    },
  ],
}

watch(
  () => form.password,
  () => {
    if (!formRef.value) return
    formRef.value.validateField('confirmPassword').catch(() => {
      // 密码确认校验失败时不需要额外处理
    })
  }
)

async function handleSubmit() {
  if (!formRef.value) return

  const valid = await formRef.value.validate()
  if (!valid) return

  submitting.value = true
  try {
    await authStore.registerUser({
      username: form.username,
      nickname: form.nickname,
      email: form.email,
      password: form.password,
      confirmPassword: form.confirmPassword,
    })
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.push(redirect)
    ElMessage.success('Account created. Welcome!')
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      ElMessage.error(error.message)
    } else {
      console.error('Registration failed', error)
      ElMessage.error('Unable to create account. Please try again.')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
	<div class="auth-page">
		<el-card class="auth-card">
			<h2>Create account</h2>
			<p class="hint">Sign up to create, share, and manage code diff links.</p>

			<el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleSubmit">
				<el-form-item label="Username" prop="username">
					<el-input v-model="form.username" autocomplete="username" placeholder="Your username" />
				</el-form-item>

				<el-form-item label="Nickname" prop="nickname">
					<el-input v-model="form.nickname" autocomplete="name" placeholder="Your nickname" />
				</el-form-item>

				<el-form-item label="Email" prop="email">
					<el-input v-model="form.email" autocomplete="email" placeholder="Your email address" />
				</el-form-item>

				<el-form-item label="Password" prop="password">
					<el-input v-model="form.password" autocomplete="new-password" show-password type="password" placeholder="Your password"/>
				</el-form-item>

				<el-form-item label="Confirm password" prop="confirmPassword">
					<el-input
						v-model="form.confirmPassword"
						autocomplete="new-password"
						show-password
						type="password"
            placeholder="Repeat Your password"
					/>
				</el-form-item>

				<el-form-item>
					<el-button :loading="submitting" style="width: 100%" type="primary" @click="handleSubmit">
						Create account
					</el-button>
				</el-form-item>
			</el-form>

			<p class="switch-link">
				Already have an account?
				<RouterLink to="/login">Sign in</RouterLink>
			</p>
		</el-card>
	</div>
</template>

<style scoped>
.auth-page {
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 48px 16px;
}

.auth-card {
	width: 100%;
	max-width: 420px;
}

.auth-card h2 {
	margin-bottom: 4px;
}

.hint {
	margin: 0 0 24px;
	color: #6b7280;
}

.switch-link {
	margin-top: 16px;
	text-align: center;
	color: #4b5563;
}

.switch-link a {
	color: #2563eb;
	font-weight: 600;
	text-decoration: none;
}

.switch-link a:hover {
	text-decoration: underline;
}
</style>
