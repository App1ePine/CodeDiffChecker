<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="not-found">
    <el-empty description="页面未找到">
      <el-button type="primary" @click="router.replace({ name: 'editor' })">返回首页</el-button>
    </el-empty>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
}
</style>
