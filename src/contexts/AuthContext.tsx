'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

// User type definition - simplified since access is determined by project/task involvement
interface User {
  id: string
  name: string
  lastName: string
  email?: string
  role: string  // Keep for backwards compatibility but not used for access control
  loginTime?: string
}

// Auth context state
interface AuthContextType {
  user: User | null
  login: (user: User) => void
  logout: () => void
  isLoading: boolean
  isAuthenticated: boolean
  sessionExpiry: Date | null
  refreshSession: () => void
  error: string | null
  clearError: () => void
}

// Storage key constant
const STORAGE_KEY = 'eo_user'
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Safe localStorage access (handles SSR)
const safeStorage = {
  get: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.error('Failed to access localStorage:', error)
      return null
    }
  },
  set: (key: string, value: string): boolean => {
    if (typeof window === 'undefined') return false
    try {
      localStorage.setItem(key, value)
      return true
    } catch (error) {
      console.error('Failed to write to localStorage:', error)
      return false
    }
  },
  remove: (key: string): boolean => {
    if (typeof window === 'undefined') return false
    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error('Failed to remove from localStorage:', error)
      return false
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionExpiry, setSessionExpiry] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Check if session is still valid
  const isSessionValid = useCallback((loginTime: string | undefined): boolean => {
    if (!loginTime) return false
    const loginDate = new Date(loginTime)
    const now = new Date()
    return (now.getTime() - loginDate.getTime()) < SESSION_DURATION_MS
  }, [])

  // Initialize auth state from storage
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const storedUser = safeStorage.get(STORAGE_KEY)
        
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser) as User
          
          // Check session validity
          if (isSessionValid(parsedUser.loginTime)) {
            setUser(parsedUser)
            
            // Calculate session expiry
            if (parsedUser.loginTime) {
              const expiry = new Date(new Date(parsedUser.loginTime).getTime() + SESSION_DURATION_MS)
              setSessionExpiry(expiry)
            }
          } else {
            // Session expired - clean up
            console.log('Session expired, logging out')
            safeStorage.remove(STORAGE_KEY)
            setError('Your session has expired. Please log in again.')
          }
        }
      } catch (error) {
        console.error('Failed to parse stored user:', error)
        safeStorage.remove(STORAGE_KEY)
        setError('Failed to restore session. Please log in again.')
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [isSessionValid])

  // Session expiry checker - runs every minute
  useEffect(() => {
    if (!user || !sessionExpiry) return

    const checkExpiry = () => {
      if (new Date() >= sessionExpiry) {
        console.log('Session expired during use')
        logout()
        setError('Your session has expired. Please log in again.')
      }
    }

    const interval = setInterval(checkExpiry, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [user, sessionExpiry])

  // Login handler
  const login = useCallback((userData: User) => {
    try {
      const userWithTime: User = {
        ...userData,
        loginTime: new Date().toISOString()
      }
      
      setUser(userWithTime)
      setSessionExpiry(new Date(Date.now() + SESSION_DURATION_MS))
      setError(null)
      
      const stored = safeStorage.set(STORAGE_KEY, JSON.stringify(userWithTime))
      
      if (!stored) {
        console.warn('Failed to persist user session to storage')
      }
      
      // Log login event
      console.log('User logged in:', {
        name: userData.name,
        role: userData.role,
        time: userWithTime.loginTime
      })
    } catch (error) {
      console.error('Login error:', error)
      setError('Failed to complete login. Please try again.')
    }
  }, [])

  // Logout handler
  const logout = useCallback(() => {
    try {
      // Log logout event
      if (user) {
        console.log('User logged out:', {
          name: user.name,
          time: new Date().toISOString()
        })
      }
      
      setUser(null)
      setSessionExpiry(null)
      setError(null)
      safeStorage.remove(STORAGE_KEY)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }, [user])

  // Refresh session (extends session without re-login)
  const refreshSession = useCallback(() => {
    if (user) {
      const refreshedUser: User = {
        ...user,
        loginTime: new Date().toISOString()
      }
      
      setUser(refreshedUser)
      setSessionExpiry(new Date(Date.now() + SESSION_DURATION_MS))
      safeStorage.set(STORAGE_KEY, JSON.stringify(refreshedUser))
      
      console.log('Session refreshed for:', user.name)
    }
  }, [user])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading,
    isAuthenticated: !!user,
    sessionExpiry,
    refreshSession,
    error,
    clearError
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Higher-order component for protected pages
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function WithAuthComponent(props: P) {
    const { isLoading, isAuthenticated, user } = useAuth()

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    }

    if (!isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/simple'
      }
      return null
    }

    return <WrappedComponent {...props} />
  }
}
