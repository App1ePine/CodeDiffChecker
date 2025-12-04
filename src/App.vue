<script lang="ts" setup>
import { ElNotification } from 'element-plus'
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const userLabel = computed(() => authStore.user?.nickname ?? authStore.user?.username ?? authStore.user?.email ?? '')

const navigationLinks = computed(() => [
  { to: { name: 'home' }, label: 'Compare', requiresAuth: false },
  { to: { name: 'dashboard' }, label: 'My Shares', requiresAuth: true },
])

const activePath = computed(() => route.name)

const currentYear = new Date().getFullYear()

async function handleLogout() {
  try {
    await authStore.logoutUser()
    await router.push({ name: 'home' })
    ElNotification.success({ message: 'Signed out' })
  } catch (error) {
    console.error('Logout failed', error)
    ElNotification.error({ message: 'Failed to sign out, please try again.' })
  }
}
</script>

<template>
	<el-container class="app-shell">
		<header class="app-header">
			<div class="brand" @click="router.push({ name: 'home' })">
				<span class="brand-title">Code Diff Checker</span>
			</div>

			<nav class="nav-links">
				<RouterLink
					v-for="link in navigationLinks"
					:key="link.label"
					v-show="!link.requiresAuth || authStore.isAuthenticated"
					:class="['nav-link', { active: activePath === link.to.name }]"
					:to="link.to"
				>
					{{ link.label }}
				</RouterLink>
			</nav>

			<div class="auth-section">
				<template v-if="authStore.isAuthenticated">
					<span class="user-chip" title="Signed in">
						{{ userLabel }}
					</span>
					<el-button size="small" type="primary" plain @click="handleLogout">Sign out</el-button>
				</template>
				<template v-else>
					<RouterLink class="nav-link" to="/login">Sign in</RouterLink>
					<RouterLink class="nav-link primary" to="/register">Get started</RouterLink>
				</template>
			</div>
		</header>

		<main class="app-main">
			<RouterView />
		</main>

		<footer class="app-footer">
			© {{ currentYear }} Code Diff Checker · ApplePine
		</footer>
	</el-container>
</template>

<style scoped>
.app-shell {
	min-height: 100vh;
	display: flex;
	flex-direction: column;
	background: #f5f6fb;
}

.app-header {
	position: sticky;
	top: 0;
	z-index: 100;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16px 32px;
	background: rgba(255, 255, 255, 0.9);
	backdrop-filter: blur(16px);
	border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

.brand {
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 8px;
}

.brand-title {
	font-size: 20px;
	font-weight: 600;
	color: #1f2937;
}

.nav-links {
	display: flex;
	align-items: center;
	gap: 12px;
}

.nav-link {
	color: #4b5563;
	font-weight: 500;
	padding: 6px 10px;
	border-radius: 8px;
	text-decoration: none;
	transition: background-color 0.2s ease, color 0.2s ease;
}

.nav-link:hover {
	background: rgba(59, 130, 246, 0.08);
	color: #2563eb;
}

.nav-link.primary {
	color: #2563eb;
	border: 1px solid rgba(37, 99, 235, 0.24);
}

.nav-link.active {
	color: #1f2937;
	background: rgba(37, 99, 235, 0.12);
}

.auth-section {
	display: flex;
	align-items: center;
	gap: 12px;
}

.user-chip {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 4px 10px;
	border-radius: 999px;
	background: rgba(37, 99, 235, 0.12);
	color: #1d4ed8;
	font-weight: 500;
}

.app-main {
	flex: 1;
	padding: 24px;
	display: flex;
	flex-direction: column;
}

.app-footer {
	padding: 24px 32px;
	text-align: center;
	color: #9ca3af;
	font-size: 14px;
	border-top: 1px solid rgba(15, 23, 42, 0.08);
	background: rgba(255, 255, 255, 0.7);
}

@media (max-width: 960px) {
	.app-header {
		flex-direction: column;
		gap: 12px;
		align-items: flex-start;
	}

	.nav-links {
		flex-wrap: wrap;
	}

	.auth-section {
		align-self: stretch;
		justify-content: space-between;
	}
}
</style>
