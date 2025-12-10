/**
 * Next.js Instrumentation - runs on app startup
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamically import to avoid client-side bundling
    const { initializeWebhook } = await import('./lib/webhook-init')
    
    // Initialize webhook after a short delay to ensure app is ready
    setTimeout(() => {
      initializeWebhook().catch(err => {
        console.error('Webhook initialization failed:', err)
      })
    }, 5000) // 5 second delay
  }
}

