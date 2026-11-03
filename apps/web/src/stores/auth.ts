import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, StatusAkun } from '@sgza/shared'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('sgza_token'))
  const user = ref<User | null>(
    localStorage.getItem('sgza_user')
      ? JSON.parse(localStorage.getItem('sgza_user')!)
      : null
  )

  const isAuthenticated = computed(() => !!token.value)
  const isVerified = computed(() => user.value?.status === ('VERIFIED' as StatusAkun))
  const isAdmin = computed(() => !!user.value?.isAdmin)

  function setAuth(newToken: string, newUser: User) {
    token.value = newToken
    user.value = newUser
    localStorage.setItem('sgza_token', newToken)
    localStorage.setItem('sgza_user', JSON.stringify(newUser))
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('sgza_token')
    localStorage.removeItem('sgza_user')
  }

  return {
    token,
    user,
    isAuthenticated,
    isVerified,
    isAdmin,
    setAuth,
    logout,
  }
})
