'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { unstable_noStore as noStore } from 'next/cache'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, LogIn, Shield } from 'lucide-react'

// Disable static generation for this page
noStore()

function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid email or password')
      } else {
        // Check if sign in was successful
        const session = await getSession()
        if (session) {
          router.push('/wbs')
        }
      }
    } catch (error) {
      setError('An error occurred during sign in')
    } finally {
      setIsLoading(false)
    }
  }

  const demoUsers = [
    {
      email: 'john.smith@ove.com',
      password: 'demo123',
      role: 'assignee',
      name: 'John Smith',
      title: 'Electrical Engineer',
      description: 'Field operations specialist'
    },
    {
      email: 'sarah.johnson@ove.com',
      password: 'demo123',
      role: 'manager',
      name: 'Sarah Johnson',
      title: 'Project Manager',
      description: 'Project coordination lead'
    },
    {
      email: 'mike.davis@ove.com',
      password: 'demo123',
      role: 'approver',
      name: 'Mike Davis',
      title: 'Operations Manager',
      description: 'Department approver'
    },
    {
      email: 'lisa.brown@ove.com',
      password: 'demo123',
      role: 'creator',
      name: 'Lisa Brown',
      title: 'Project Coordinator',
      description: 'Project intake specialist'
    },
    {
      email: 'david.wilson@ove.com',
      password: 'demo123',
      role: 'eo_engineer',
      name: 'David Wilson',
      title: 'EO Engineer',
      description: 'System administrator'
    },
  ]

  const fillDemoCredentials = (user: typeof demoUsers[0]) => {
    setEmail(user.email)
    setPassword(user.password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-blue-600 to-green-600 rounded-xl flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            Ohio Valley Electric
          </h2>
          <p className="text-lg text-gray-600 mt-1">
            Electrical Operations
          </p>
          <p className="mt-2 text-sm text-gray-600">
            Project Management System
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Demo Authentication</CardTitle>
            <CardDescription>
              Use one of the demo accounts below or enter your own credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                  placeholder="Enter your password"
                />
              </div>

              <Button
                type="submit"
                className="w-full btn-electric"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign in
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Demo Accounts</span>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3">
                {demoUsers.map((user) => (
                  <button
                    key={user.email}
                    onClick={() => fillDemoCredentials(user)}
                    className="w-full inline-flex justify-center py-4 px-4 border border-blue-200 rounded-lg shadow-sm bg-gradient-to-r from-blue-50 to-white text-sm font-medium text-blue-700 hover:from-blue-100 hover:to-blue-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                  >
                    <span className="text-left flex items-center w-full">
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mr-4">
                        <span className="text-white font-bold text-sm">
                          {(user.name || user.email)[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{user.name}</div>
                        <div className="text-xs text-blue-600 font-medium">{user.title}</div>
                        <div className="text-xs text-gray-500">{user.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Click to login</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <>
      <SignInForm />
    </>
  )
}
