<script lang="ts" setup>
import { Loading } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElNotification } from 'element-plus'
import { reactive, ref } from 'vue'

const formRef = ref<FormInstance | null>(null)
const submitting = ref(false)
const installed = ref(false)
const checking = ref(true)

import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(async () => {
  try {
    const res = await fetch('/api/install/status')
    if (res.ok) {
      const data = await res.json()
      if (data.installed) {
        installed.value = true
      }
    }
  } catch (e) {
    // ignore
  } finally {
    checking.value = false
  }
})

const form = reactive({
  dbType: 'mysql',
  dbHost: '127.0.0.1',
  dbPort: 3306,
  dbName: 'code_diff_checker',
  dbUser: 'root',
  dbPassword: '',
  jwtSecret: '',
  adminUsername: 'admin',
  adminEmail: 'admin@example.com',
  adminNickname: '系统管理员',
  adminPassword: '',
})

const rules: FormRules = {
  dbType: [{ required: true, message: 'Please select database type', trigger: 'change' }],
  dbHost: [{ required: true, message: 'Host is required', trigger: 'blur' }],
  dbPort: [{ required: true, message: 'Port is required', trigger: 'blur' }],
  dbName: [{ required: true, message: 'Database name is required', trigger: 'blur' }],
  dbUser: [{ required: true, message: 'Database user is required', trigger: 'blur' }],
  jwtSecret: [
    { required: true, message: 'JWT Secret is required', trigger: 'blur' },
    { min: 32, message: 'Must be at least 32 characters', trigger: 'blur' },
  ],
  adminUsername: [
    { required: true, message: 'Username is required', trigger: 'blur' },
    { min: 3, max: 12, message: 'Length should be 3 to 12', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]+$/, message: 'Only letters, numbers and underscore', trigger: 'blur' },
  ],
  adminEmail: [
    { required: true, message: 'Email is required', trigger: 'blur' },
    { type: 'email', message: 'Invalid email address', trigger: 'blur' },
  ],
  adminNickname: [
    { required: true, message: 'Nickname is required', trigger: 'blur' },
    { min: 2, max: 24, message: 'Length should be 2 to 24', trigger: 'blur' },
  ],
  adminPassword: [
    { required: true, message: 'Password is required', trigger: 'blur' },
    { min: 6, max: 24, message: 'Length should be 6 to 24', trigger: 'blur' },
  ],
}

const generateSecret = () => {
  const array = new Uint8Array(32)
  window.crypto.getRandomValues(array)
  form.jwtSecret = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// 数据库类型切换时更新默认端口
const handleDbTypeChange = (value: string) => {
  if (value === 'mysql') {
    form.dbPort = 3306
  } else if (value === 'postgresql') {
    form.dbPort = 5432
  } else if (value === 'mssql') {
    form.dbPort = 1433
  }
}

// 默认生成一个密钥
generateSecret()

async function handleSubmit() {
  if (!formRef.value) return

  const valid = await formRef.value.validate()
  if (!valid) return

  submitting.value = true
  try {
    const response = await fetch('/api/install', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(form),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Installation failed')
    }

    ElNotification.success({ message: '安装成功！正在跳转...' })
    setTimeout(() => {
      window.location.href = '/'
    }, 1500)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Installation failed'
    ElNotification.error({ message })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="install-page">
    <el-card class="install-card">
      <div v-if="checking" class="text-center">
        <el-icon class="is-loading">
          <Loading />
        </el-icon> Checking status...
      </div>
      <div v-else-if="installed" class="installed-msg">
        <el-result icon="success" title="Running" sub-title="The application is already installed and running.">
          <template #extra>
            <el-button type="primary" @click="router.push('/')">Go Home</el-button>
          </template>
        </el-result>
      </div>
      <template v-else>
        <h2>安装</h2>
        <p class="hint">配置数据库以开始使用。</p>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleSubmit">

          <el-form-item label="数据库类型" prop="dbType">
            <el-radio-group v-model="form.dbType" @change="handleDbTypeChange">
              <el-radio-button label="mysql">MySQL / MariaDB</el-radio-button>
              <el-radio-button label="postgresql">PostgreSQL</el-radio-button>
              <el-radio-button label="mssql">SQL Server / MSSQL</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <div class="form-row">
            <el-form-item label="主机" prop="dbHost" style="flex: 2">
              <el-input v-model="form.dbHost" placeholder="localhost" />
            </el-form-item>
            <el-form-item label="端口" prop="dbPort" style="flex: 1">
              <el-input-number v-model="form.dbPort" :min="1" :max="65535" style="width: 100%" />
            </el-form-item>
          </div>

          <el-form-item label="数据库名称" prop="dbName">
            <el-input v-model="form.dbName" placeholder="code_diff_checker" />
          </el-form-item>

          <el-form-item label="数据库用户" prop="dbUser">
            <el-input v-model="form.dbUser" placeholder="root" />
          </el-form-item>

          <el-form-item label="数据库密码" prop="dbPassword">
            <el-input v-model="form.dbPassword" type="password" show-password placeholder="Password" />
          </el-form-item>

          <el-divider />

          <el-form-item label="JWT 密钥" prop="jwtSecret">
            <el-input v-model="form.jwtSecret" placeholder="Random string for session security">
              <template #append>
                <el-button @click="generateSecret">生成</el-button>
              </template>
            </el-input>
          </el-form-item>

          <el-divider content-position="center">Admin Account</el-divider>

          <el-form-item label="管理员用户名" prop="adminUsername">
            <el-input v-model="form.adminUsername" placeholder="admin" />
          </el-form-item>

          <el-form-item label="管理员邮箱" prop="adminEmail">
            <el-input v-model="form.adminEmail" placeholder="admin@example.com" />
          </el-form-item>

          <el-form-item label="管理员昵称" prop="adminNickname">
            <el-input v-model="form.adminNickname" placeholder="System Administrator" />
          </el-form-item>

          <el-form-item label="管理员密码" prop="adminPassword">
            <el-input v-model="form.adminPassword" type="password" show-password placeholder="Password" />
          </el-form-item>

          <el-form-item>
            <el-button :loading="submitting" type="primary" style="width: 100%" @click="handleSubmit">
              安装并初始化
            </el-button>
          </el-form-item>
        </el-form>
      </template>
    </el-card>
  </div>
</template>

<style scoped>
.text-center {
  text-align: center;
  padding: 20px;
  color: #666;
}

.install-page {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f3f4f6;
  padding: 20px;
}

.install-card {
  width: 100%;
  max-width: 500px;
}

.install-card h2 {
  margin-bottom: 4px;
  text-align: center;
}

.hint {
  margin: 0 0 24px;
  color: #6b7280;
  text-align: center;
}

.form-row {
  display: flex;
  gap: 16px;
}
</style>
