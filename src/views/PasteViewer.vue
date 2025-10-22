<script lang="ts" setup>
const props = defineProps<{ slug: string }>()
</script>

<template>
  <section class="paste-viewer">
    <el-card shadow="never" class="viewer-card">
      <template #header>
        <div class="viewer-header">
          <h2>分享详情</h2>
          <span class="viewer-slug">{{ props.slug }}</span>
        </div>
      </template>
      <el-empty description="暂无分享内容，敬请期待" />
      <div class="viewer-actions">
        <RouterLink to="/pastes/new" custom v-slot="{ navigate }">
          <el-button type="primary" @click="navigate">创建新的对比</el-button>
        </RouterLink>
      </div>
    </el-card>
  </section>
</template>

<style scoped>
.paste-viewer {
  display: flex;
  justify-content: center;
}

.viewer-card {
  width: 100%;
  max-width: 960px;
}

.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.viewer-slug {
  font-size: 12px;
  color: #6b7280;
}

.viewer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}
</style>
