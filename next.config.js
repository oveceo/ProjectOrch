/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for Render deployment
  output: 'standalone',
  
  // Environment variables exposed to the browser
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    APP_BASE_URL: process.env.APP_BASE_URL,
  },

  // External packages for server components
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'pino'],
    instrumentationHook: true, // Enable auto-webhook registration on startup
  },

  // Production optimizations
  poweredByHeader: false, // Security: remove X-Powered-By header

  // Compression
  compress: true,

  // Image optimization
  images: {
    unoptimized: true, // For share drive deployment without image optimization server
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // CORS headers for API routes
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.CORS_ORIGIN || '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ]
  },

  // Redirects
  async redirects() {
    return [
      // Redirect root to WBS home
      {
        source: '/',
        destination: '/wbs',
        permanent: false,
      },
      // Redirect old dashboard to WBS
      {
        source: '/dashboard',
        destination: '/wbs',
        permanent: false,
      },
    ]
  },

  // Logging configuration
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === 'development',
    },
  },

  // Bundle analyzer (uncomment to analyze bundle)
  // bundleAnalyzer: {
  //   enabled: process.env.ANALYZE === 'true',
  // },

  // Custom webpack config if needed
  webpack: (config, { isServer }) => {
    // Ignore specific warnings
    config.ignoreWarnings = [
      { module: /node_modules\/punycode/ },
    ]

    // Add aliases for cleaner imports
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, 'src'),
    }

    return config
  },
}

module.exports = nextConfig
