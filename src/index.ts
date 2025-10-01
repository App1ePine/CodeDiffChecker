import '@git-diff-view/vue/styles/diff-view-pure.css'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createApp } from 'vue'
import App from './App.vue'
import './main.css'

const app = createApp(App)

app.use(ElementPlus)

app.mount('#root')
