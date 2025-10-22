import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import PasteEditor from '../views/PasteEditor.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    component: Dashboard,
  },
  {
    path: '/pastes/new',
    component: PasteEditor,
  },
  {
    path: '/pastes/:id/edit',
    component: PasteEditor,
    props: true,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
