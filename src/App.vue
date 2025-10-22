<script lang="ts" setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const activeMenu = computed(() => {
  if (route.path.startsWith('/pastes/new')) {
    return '/pastes/new'
  }
  if (route.path.startsWith('/pastes')) {
    return '/dashboard'
  }
  return route.path
})
</script>

<template>
  <div class="app-shell">
    <el-container>
      <el-header class="app-shell__header">
        <div class="app-shell__brand">
          <span class="app-shell__title">Paste Center</span>
          <small class="app-shell__subtitle">集中管理与分享你的代码片段</small>
        </div>
        <el-menu :default-active="activeMenu" class="app-shell__menu" mode="horizontal" router>
          <el-menu-item index="/dashboard">仪表盘</el-menu-item>
          <el-menu-item index="/pastes/new">新建 Paste</el-menu-item>
        </el-menu>
      </el-header>
      <el-main class="app-shell__main">
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: #f5f6fb;
}

.app-shell__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.app-shell__brand {
  display: flex;
  flex-direction: column;
}

.app-shell__title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.app-shell__subtitle {
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
}

.app-shell__menu {
  border-bottom: none;
}

.app-shell__main {
  padding: 24px;
}
</style>
