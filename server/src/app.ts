import fastify from 'fastify'
import cors from '@fastify/cors'
import { authRoutes } from './routes/authRoutes.js'
import { cartaoRoutes } from './routes/cartaoRoutes.js'
import { gastoRoutes } from './routes/gastoRoutes.js'

export function buildApp() {
  const app = fastify({ logger: false })

  // CORS setup — allows both local dev and Vercel prod origins
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  // Healthcheck
  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })

  // Register API Routes
  app.register(authRoutes, { prefix: '/api/auth' })
  app.register(cartaoRoutes, { prefix: '/api/cartoes' })
  app.register(gastoRoutes, { prefix: '/api/gastos' })

  return app
}
