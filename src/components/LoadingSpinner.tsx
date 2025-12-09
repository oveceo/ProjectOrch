'use client'

import { Loader2, Zap } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  fullScreen?: boolean
}

export function LoadingSpinner({ 
  size = 'md', 
  text = 'Loading...', 
  fullScreen = false 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  }

  const textClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg',
  }

  const spinner = (
    <div className="flex flex-col items-center justify-center space-y-3">
      <div className="relative">
        <Loader2 className={`${sizeClasses[size]} animate-spin text-blue-600`} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap className={`${size === 'sm' ? 'h-2 w-2' : size === 'md' ? 'h-3 w-3' : 'h-4 w-4'} text-blue-400`} />
        </div>
      </div>
      {text && (
        <p className={`${textClasses[size]} text-gray-600 font-medium`}>
          {text}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }

  return spinner
}

// Page-level loading component
export function PageLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-8">
        <LoadingSpinner size="lg" text={message} />
      </div>
    </div>
  )
}

// Skeleton loaders for different components
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {/* Header */}
      <div className="h-10 bg-gray-200 rounded w-full" />
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded w-full" />
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-6 space-y-4">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-8 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-full" />
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-8">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-2" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-6">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-6" />
        <TableSkeleton rows={5} />
      </div>
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Form header */}
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      
      {/* Form fields */}
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-10 bg-gray-100 rounded w-full" />
          </div>
        ))}
      </div>
      
      {/* Submit button */}
      <div className="h-10 bg-gray-200 rounded w-32" />
    </div>
  )
}

