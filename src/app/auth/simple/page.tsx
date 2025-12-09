'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Users, Lock, AlertTriangle, CheckCircle } from 'lucide-react'

// Predefined users list - Transmission team members
const USERS = [
  'Adams',
  'Allen',
  'Barringer',
  'Campbell',
  'Clark',
  'Donahue',
  'Egbert',
  'Elswick',
  'Fields',
  'Forster',
  'Galloway',
  'Green',
  'Hicks',
  'Holskey',
  'Huff',
  'McCord',
  'Merritt',
  'Privette',
  'Roberts',
  'Southall',
  'Thomas',
  'Thompson',
  'Waugh',
  'Woodworth'
]

interface User {
  id: string
  name: string
  lastName: string
  role: 'user'  // Simplified - everyone is a user, access determined by project involvement
}

export default function SimpleLoginPage() {
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { login } = useAuth()

  // Debug logging
  console.log('SimpleLoginPage rendered, selectedUser:', selectedUser)

  const handleUserChange = (value: string) => {
    console.log('User selected:', value)
    setSelectedUser(value)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!selectedUser) {
      setError('Please select a user')
      setLoading(false)
      return
    }

    // Generate expected password (lastname + "123")
    const expectedPassword = selectedUser.toLowerCase() + '123'

    if (password !== expectedPassword) {
      setError('Invalid password')
      setLoading(false)
      return
    }

    try {
      // Create user object - access is determined by project/task involvement, not roles
      const user: User = {
        id: selectedUser.toLowerCase(),
        name: selectedUser,
        lastName: selectedUser,
        role: 'user'
      }

      // Use AuthContext to login
      login(user)

      // Redirect to main WBS page
      router.push('/wbs')
    } catch (error) {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Transmission Project Orchestrator</CardTitle>
          <CardDescription>
            Work Breakdown Structure Task Management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user">Select Your Name</Label>
              <Select value={selectedUser} onValueChange={handleUserChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose your name" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {USERS.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              {selectedUser && (
                <p className="text-xs text-gray-500">
                  Default password: {selectedUser.toLowerCase()}123
                </p>
              )}
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800">Login Failed</AlertTitle>
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full btn-electric" disabled={loading}>
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing In...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-2">Available Users:</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {USERS.slice(0, 12).map((user) => (
                  <div key={user} className="text-gray-500">{user}</div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs mt-1">
                {USERS.slice(12).map((user) => (
                  <div key={user} className="text-gray-500">{user}</div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
