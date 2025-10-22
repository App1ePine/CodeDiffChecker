import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'editor',
      component: () => import('../views/PasteEditor.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/Register.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/p/:slug',
      name: 'pasteViewer',
      component: () => import('../views/PasteViewer.vue'),
      props: true,
    },
    {
      path: '/p/:slug/edit',
      name: 'pasteEdit',
      component: () => import('../views/PasteEditor.vue'),
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/my-pastes',
      name: 'myPastes',
      component: () => import('../views/MyPastes.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'notFound',
      component: () => import('../views/NotFound.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isAuthenticated.value) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.requiresGuest && auth.isAuthenticated.value) {
    return { name: 'editor' }
  }

  return true
})

export default router
