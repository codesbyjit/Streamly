"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react"
import { apiInstance } from "@/lib/api"
import { useRouter } from "next/navigation"

interface User {
  username: string
  email: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const checkAuth = async () => {
    try {
      const { data } = await apiInstance.get("/user/me")
      setUser(data)
    } catch {
      setUser(null)
    }
  }

  const login = async (email: string, password: string) => {
    await apiInstance.post("/auth/login", { email, password })
    await checkAuth()
    router.push("/")
  }

  const signup = async (username: string, email: string, password: string) => {
    await apiInstance.post("/auth/register", { username, email, password })
    router.push("/login")
  }

  const logout = async () => {
    await apiInstance.post("/auth/logout")
    setUser(null)
    router.push("/login")
  }

  useEffect(() => {
    checkAuth().finally(() => setIsLoading(false))
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, signup, logout, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
