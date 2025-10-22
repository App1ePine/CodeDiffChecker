import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import { createPinia } from '@/lib/pinia'
import router from './router'
import App from './App.vue'
import 'element-plus/dist/index.css'
import '@git-diff-view/vue/styles/diff-view.css'
import './assets/css/main.css'

const app = createApp(App)

const pinia = createPinia()

app.use(ElementPlus)
app.use(pinia)
app.use(router)

app.mount('#root')
