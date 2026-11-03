import { createRouter, createWebHistory } from 'vue-router'
import { ref } from 'vue'
import HomeView from '@/views/HomeView.vue'
import SejarahView from '@/views/SejarahView.vue'
import MapView from '@/views/MapView.vue'
import LoginView from '@/views/LoginView.vue'
import RegisterView from '@/views/RegisterView.vue'
import SlangView from '@/views/SlangView.vue'
import KomunitasView from '@/views/KomunitasView.vue'
import AdminView from '@/views/AdminView.vue'

export const isPageLoading = ref(false)
export const pageLoadingProgress = ref(0)
let progressInterval: ReturnType<typeof setInterval> | null = null
let finishTimeout: ReturnType<typeof setTimeout> | null = null
let loadStartTime = 0

export function startPageLoading() {
  if (finishTimeout) {
    clearTimeout(finishTimeout)
    finishTimeout = null
  }
  isPageLoading.value = true
  pageLoadingProgress.value = 25
  loadStartTime = Date.now()

  if (progressInterval) clearInterval(progressInterval)
  progressInterval = setInterval(() => {
    if (pageLoadingProgress.value < 88) {
      pageLoadingProgress.value += Math.floor(Math.random() * 12) + 6
      if (pageLoadingProgress.value > 88) pageLoadingProgress.value = 88
    }
  }, 60)
}

export function finishPageLoading() {
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }

  // Jamin ada durasi tampilan minimal (300ms) agar transisi loading terlihat jelas & mulus oleh user
  const elapsed = Date.now() - loadStartTime
  const minDisplayTime = 300
  const delay = Math.max(0, minDisplayTime - elapsed)

  finishTimeout = setTimeout(() => {
    pageLoadingProgress.value = 100
    finishTimeout = setTimeout(() => {
      isPageLoading.value = false
      pageLoadingProgress.value = 0
      finishTimeout = null
    }, 220)
  }, delay)
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/sejarah',
      name: 'sejarah',
      component: SejarahView,
    },
    {
      path: '/map',
      name: 'map',
      component: MapView,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterView,
      meta: { guestOnly: true },
    },
    {
      path: '/slang',
      name: 'slang',
      component: SlangView,
    },
    {
      path: '/komunitas',
      name: 'komunitas',
      component: KomunitasView,
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiresAdmin: true },
    },
  ],
})

// Navigation Guard
// NOTE: useAuthStore() must be called INSIDE the guard callback (after Pinia is active)
router.beforeEach((to, from, next) => {
  if (to.path !== from.path) {
    startPageLoading()
  }

  // Lazily resolve Pinia store inside callback to avoid "getActivePinia() called without active Pinia" crash
  let isAuthenticated = false
  let isAdmin = false

  try {
    const token = localStorage.getItem('sgza_token')
    const userRaw = localStorage.getItem('sgza_user')
    isAuthenticated = !!token
    if (userRaw) {
      const user = JSON.parse(userRaw)
      isAdmin = !!user?.isAdmin
    }
  } catch {
    isAuthenticated = false
    isAdmin = false
  }

  if (to.meta.requiresAdmin) {
    if (!isAuthenticated || !isAdmin) {
      finishPageLoading()
      return next('/login')
    }
  }

  if (to.meta.guestOnly && isAuthenticated) {
    finishPageLoading()
    return next('/map')
  }

  next()
})

router.afterEach(() => {
  finishPageLoading()
})

export default router
