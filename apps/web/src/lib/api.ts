import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sgza_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Jangan set Content-Type jika data adalah FormData
  // Biarkan browser otomatis set dengan boundary yang benar
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

// Response interceptor to handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sgza_token')
      localStorage.removeItem('sgza_user')
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

/**
 * Upload FormData menggunakan fetch native (bukan axios) untuk menghindari
 * konflik header Content-Type. Axios instance berpotensi override boundary.
 */
export async function apiFormData(
  method: 'POST' | 'PATCH',
  url: string,
  formData: FormData,
): Promise<any> {
  const token = localStorage.getItem('sgza_token')
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  // JANGAN set Content-Type — browser akan auto-set dengan boundary

  const response = await fetch(`/api${url}`, {
    method,
    headers,
    body: formData,
  })

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ message: `HTTP ${response.status}` }))
    const err: any = new Error(errBody.message || `HTTP ${response.status}`)
    err.response = { status: response.status, data: errBody }
    throw err
  }

  return response.json()
}
