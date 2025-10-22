<template>
  <div class="app-container">
    <el-container>
      <el-header class="app-header" height="auto">
        <h1>Code Diff Checker</h1>
        <p class="subtitle">基于 git-diff-view 的代码差异对比工具</p>
      </el-header>
      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  background-color: #f5f6fb;
}

.app-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 0 0;
}

.app-header h1 {
  font-size: 32px;
  font-weight: 600;
}

.subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 14px;
}

.app-main {
  padding: 24px;
}
</style>
