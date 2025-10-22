<template>
  <section class="not-found">
    <el-result icon="warning" title="页面不存在" sub-title="请检查链接是否正确">
      <template #extra>
        <RouterLink to="/pastes/new" custom v-slot="{ navigate }">
          <el-button type="primary" @click="navigate">返回首页</el-button>
        </RouterLink>
      </template>
    </el-result>
  </section>
</template>

<style scoped>
.not-found {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}
</style>
