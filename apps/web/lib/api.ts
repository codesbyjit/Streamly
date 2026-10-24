import axios from "axios"

export const apiInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "/api/v1",
  withCredentials: true,
//   timeout: 10000,
})

apiInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("Unauthorized. Redirecting to login...")
    }
    return Promise.reject(error)
  }
)
