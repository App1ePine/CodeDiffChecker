<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAuthStore } from './stores/auth'

const router = useRouter()
const auth = useAuthStore()

const isAuthenticated = computed(() => auth.isAuthenticated.value)
const userName = computed(() => auth.user.value?.username ?? auth.user.value?.email ?? '用户')
const userInitial = computed(() => (userName.value?.[0] ?? 'U').toUpperCase())

const goHome = () => {
  router.push({ name: 'editor' })
}

const goLogin = () => {
  router.push({ name: 'login' })
}

const goRegister = () => {
  router.push({ name: 'register' })
}

const goMyPastes = () => {
  router.push({ name: 'myPastes' })
}

const handleCommand = async (command: string) => {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确认要退出登录吗？', '提示', {
        confirmButtonText: '退出',
        cancelButtonText: '取消',
        type: 'warning',
      })
      auth.clearAuth()
      ElMessage.success('已退出登录')
      router.push({ name: 'login' })
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      ElMessage.error('退出登录失败，请稍后重试')
    }
  }
}
</script>

<template>
  <el-container class="app-container">
    <el-header class="app-header" height="auto">
      <div class="brand" @click="goHome">
        <span class="brand-title">Code Diff Checker</span>
        <span class="brand-subtitle">基于 git-diff-view 的代码差异工具</span>
      </div>
      <nav class="nav-links">
        <RouterLink :to="{ name: 'editor' }" class="nav-link">编辑器</RouterLink>
        <RouterLink v-if="isAuthenticated" :to="{ name: 'myPastes' }" class="nav-link">我的 Paste</RouterLink>
      </nav>
      <div class="nav-actions">
        <template v-if="!isAuthenticated">
          <el-button text type="primary" @click="goLogin">登录</el-button>
          <el-button plain type="primary" @click="goRegister">注册</el-button>
        </template>
        <template v-else>
          <el-button text type="primary" @click="goMyPastes">我的 Paste</el-button>
          <el-dropdown trigger="click" @command="handleCommand">
            <span class="user-trigger">
              <el-avatar size="small">{{ userInitial }}</el-avatar>
              <span class="user-name">{{ userName }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </div>
    </el-header>
    <el-main class="app-main">
      <RouterView />
    </el-main>
  </el-container>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #f5f6fb 0%, #ffffff 100%);
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 12px 24px;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
}

.brand {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  user-select: none;
}

.brand-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.brand-subtitle {
  color: #6b7280;
  font-size: 12px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-link {
  color: #374151;
  text-decoration: none;
  font-weight: 500;
}

.nav-link.router-link-active {
  color: #2563eb;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.user-name {
  font-weight: 500;
}

.app-main {
  padding: 0 24px 48px;
}
</style>
