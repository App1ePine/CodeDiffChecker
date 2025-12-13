import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import DashboardView from '@/views/DashboardView.vue'
import DiffHome from '@/views/DiffHome.vue'
import ExploreView from '@/views/ExploreView.vue'
import InstallView from '@/views/Install.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import ShareViewer from '@/views/ShareViewer.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: DiffHome,
      meta: { title: 'Code Diff Checker' },
    },
    {
      path: '/explore',
      name: 'explore',
      component: ExploreView,
      meta: { title: 'Explore Shares' },
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { requiresGuest: true, title: 'Sign In' },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { requiresGuest: true, title: 'Create Account' },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true, title: 'Share Dashboard' },
    },
    {
      path: '/shares/:slug',
      name: 'share-viewer',
      component: ShareViewer,
      meta: { title: 'Shared Diff' },
    },
    {
      path: '/install',
      name: 'install',
      component: InstallView,
      meta: { title: 'Installation' },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  if (!authStore.isBootstrapped) {
    await authStore.bootstrap()
  }

  // 鉴权检查
  if (to.meta?.requiresAuth && !authStore.isAuthenticated) {
    return next({ name: 'login', query: { redirect: to.fullPath } })
  }

  if (to.meta?.requiresGuest && authStore.isAuthenticated) {
    return next({ name: 'dashboard' })
  }

  // 设置页面标题
  if (to.meta?.title) {
    document.title = `Code Diff Checker - ${String(to.meta.title)}`
  } else {
    document.title = 'Code Diff Checker'
  }

  next()
})

export default router
