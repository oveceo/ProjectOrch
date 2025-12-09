import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    const userLastName = authHeader.replace('Bearer ', '')
    
    // Determine role (same logic as login)
    const adminUsers = ['Forster', 'Clark', 'Huff', 'Holskey', 'Woodworth', 'Privette']
    const userRole = adminUsers.includes(userLastName) ? 'eo_engineer' : 'assignee'
    
    return NextResponse.json({
      userLastName,
      userRole,
      isAdmin: userRole === 'eo_engineer',
      authHeader
    })

  } catch (error) {
    console.error('Error in debug user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
