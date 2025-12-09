import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for debouncing a value
 * Useful for search inputs, API calls on input change, etc.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Custom hook for debouncing a callback function
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>()

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return debouncedCallback
}

/**
 * Custom hook for auto-saving with debounce
 */
export function useAutoSave<T>(
  data: T,
  onSave: (data: T) => Promise<void>,
  delay: number = 1000
): {
  isSaving: boolean
  lastSaved: Date | null
  error: string | null
} {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const debouncedData = useDebounce(data, delay)
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip first render to avoid saving initial data
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    const save = async () => {
      setIsSaving(true)
      setError(null)
      
      try {
        await onSave(debouncedData)
        setLastSaved(new Date())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Auto-save failed')
        console.error('Auto-save failed:', err)
      } finally {
        setIsSaving(false)
      }
    }

    save()
  }, [debouncedData, onSave])

  return { isSaving, lastSaved, error }
}

