import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import AzureADProvider from 'next-auth/providers/azure-ad'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './db'
import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    // Azure AD Provider
    ...(process.env.AAD_CLIENT_ID && process.env.AAD_CLIENT_SECRET && process.env.AAD_TENANT_ID
      ? [AzureADProvider({
          clientId: process.env.AAD_CLIENT_ID,
          clientSecret: process.env.AAD_CLIENT_SECRET,
          tenantId: process.env.AAD_TENANT_ID,
          authorization: {
            params: {
              scope: 'openid profile email User.Read'
            }
          }
        })]
      : []
    ),

    // Local demo provider (only if AUTH_LOCAL_DEMO=1)
    ...(process.env.AUTH_LOCAL_DEMO === '1'
      ? [CredentialsProvider({
          name: 'Demo Login',
          credentials: {
            email: { label: 'Email', type: 'email' },
            password: { label: 'Password', type: 'password' }
          },
          async authorize(credentials) {
            if (!credentials?.email || !credentials?.password) {
              return null
            }

            // Demo users
            const demoUsers = [
              {
                email: 'john.smith@ove.com',
                password: 'demo123',
                role: UserRole.assignee,
                name: 'John Smith',
                title: 'Electrical Engineer',
                description: 'Field operations specialist'
              },
              {
                email: 'sarah.johnson@ove.com',
                password: 'demo123',
                role: UserRole.manager,
                name: 'Sarah Johnson',
                title: 'Project Manager',
                description: 'Project coordination lead'
              },
              {
                email: 'mike.davis@ove.com',
                password: 'demo123',
                role: UserRole.approver,
                name: 'Mike Davis',
                title: 'Operations Manager',
                description: 'Department approver'
              },
              {
                email: 'lisa.brown@ove.com',
                password: 'demo123',
                role: UserRole.creator,
                name: 'Lisa Brown',
                title: 'Project Coordinator',
                description: 'Project intake specialist'
              },
              {
                email: 'david.wilson@ove.com',
                password: 'demo123',
                role: UserRole.eo_engineer,
                name: 'David Wilson',
                title: 'EO Engineer',
                description: 'System administrator'
              }
            ]

            const user = demoUsers.find(u => u.email === credentials.email)
            if (!user) return null

            // Simple password check for demo purposes
            if (credentials.password !== user.password) return null

            // Ensure user exists in database
            const dbUser = await prisma.user.upsert({
              where: { email: user.email },
              update: { name: user.name, role: user.role },
              create: {
                email: user.email,
                name: user.name,
                role: user.role
              }
            })

            return {
              id: dbUser.id,
              email: dbUser.email,
              name: dbUser.name,
              role: dbUser.role
            }
          }
        })]
      : []
    )
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.role = user.role || UserRole.assignee
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as UserRole
      }
      return session
    },
    async signIn({ user, account, profile }) {
      // Ensure user exists in database for Azure AD users
      if (account?.provider === 'azure-ad' && user.email) {
        await prisma.user.upsert({
          where: { email: user.email },
          update: { name: user.name },
          create: {
            email: user.email,
            name: user.name,
            role: UserRole.assignee // Default role, can be updated by admin
          }
        })
      }
      return true
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  },
  secret: process.env.NEXTAUTH_SECRET
}
