<script lang="ts" setup>
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api/types'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref<FormInstance | null>(null)
const submitting = ref(false)

const form = reactive({
  displayName: '',
  email: '',
  password: '',
})

const rules: FormRules = {
  displayName: [
    { required: true, message: 'Display name is required', trigger: 'blur' },
    { min: 2, message: 'Display name should be at least 2 characters', trigger: 'blur' },
  ],
  email: [
    { required: true, message: 'Email is required', trigger: 'blur' },
    { type: 'email', message: 'Please enter a valid email address', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Password is required', trigger: 'blur' },
    { min: 8, message: 'Password must be at least 8 characters', trigger: 'blur' },
  ],
}

async function handleSubmit() {
  if (!formRef.value) return

  const valid = await formRef.value.validate()
  if (!valid) return

  submitting.value = true
  try {
    await authStore.registerUser({
      displayName: form.displayName,
      email: form.email,
      password: form.password,
    })
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.push(redirect)
    ElMessage.success('Account created. Welcome!')
  } catch (error) {
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
				<el-form-item label="Display name" prop="displayName">
					<el-input v-model="form.displayName" autocomplete="name" placeholder="Jane Developer" />
				</el-form-item>

				<el-form-item label="Email" prop="email">
					<el-input v-model="form.email" autocomplete="email" placeholder="you@example.com" />
				</el-form-item>

				<el-form-item label="Password" prop="password">
					<el-input v-model="form.password" autocomplete="new-password" show-password type="password" />
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
