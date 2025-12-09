import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface UseApiOptions {
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
}

interface ApiState<T> {
  data: T | null
  isLoading: boolean
  error: Error | null
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Custom hook for making authenticated API calls
 */
export function useApi<T = any>(options: UseApiOptions = {}) {
  const { user } = useAuth()
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  })

  const execute = useCallback(
    async (
      url: string,
      fetchOptions: RequestInit = {}
    ): Promise<T | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          ...(user?.lastName && {
            Authorization: `Bearer ${user.lastName}`,
          }),
          ...fetchOptions.headers,
        }

        const response = await fetch(url, {
          ...fetchOptions,
          headers,
        })

        const result: ApiResponse<T> = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || result.message || 'Request failed')
        }

        setState({
          data: result.data || null,
          isLoading: false,
          error: null,
        })

        options.onSuccess?.(result.data)
        return result.data || null
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setState({
          data: null,
          isLoading: false,
          error,
        })
        options.onError?.(error)
        return null
      }
    },
    [user?.lastName, options]
  )

  const get = useCallback(
    (url: string) => execute(url, { method: 'GET' }),
    [execute]
  )

  const post = useCallback(
    (url: string, body: any) =>
      execute(url, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    [execute]
  )

  const put = useCallback(
    (url: string, body: any) =>
      execute(url, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    [execute]
  )

  const del = useCallback(
    (url: string) => execute(url, { method: 'DELETE' }),
    [execute]
  )

  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      error: null,
    })
  }, [])

  return {
    ...state,
    execute,
    get,
    post,
    put,
    delete: del,
    reset,
  }
}

/**
 * Hook for fetching data on mount
 */
export function useFetch<T = any>(url: string, options: UseApiOptions = {}) {
  const api = useApi<T>(options)
  const { user } = useAuth()

  // Fetch on mount when user is available
  const refetch = useCallback(() => {
    if (user) {
      api.get(url)
    }
  }, [api, url, user])

  return {
    ...api,
    refetch,
  }
}

