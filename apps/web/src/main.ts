import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import 'leaflet/dist/leaflet.css'
import './assets/main.css'

const app = createApp(App)

// Global error handler to catch silent crashes
app.config.errorHandler = (err, instance, info) => {
  console.error('[SGZA] Global Vue Error:', err)
  console.error('[SGZA] Component:', instance)
  console.error('[SGZA] Info:', info)
}

app.config.warnHandler = (msg, instance, trace) => {
  console.warn('[SGZA] Vue Warning:', msg, trace)
}

app.use(createPinia())
app.use(router)

app.mount('#app')
