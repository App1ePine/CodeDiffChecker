<template>
  <section class="dashboard">
    <el-card shadow="never" class="dashboard-card">
      <h2>控制面板</h2>
      <p class="dashboard-tip">这里将展示你的历史分享与统计。</p>
      <RouterLink to="/pastes/new" custom v-slot="{ navigate }">
        <el-button type="primary" @click="navigate">创建新的对比</el-button>
      </RouterLink>
    </el-card>
  </section>
</template>

<style scoped>
.dashboard {
  display: flex;
  justify-content: center;
}

.dashboard-card {
  width: 100%;
  max-width: 960px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dashboard-tip {
  color: #6b7280;
}
</style>
