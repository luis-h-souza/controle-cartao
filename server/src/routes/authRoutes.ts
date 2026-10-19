import { FastifyInstance } from 'fastify'
import { AuthController } from '../controllers/AuthController.js'
import { authMiddleware } from '../middlewares/auth.js'

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', AuthController.register)
  app.post('/login', AuthController.login)
  app.post('/refresh', AuthController.refresh)
  app.post('/logout', AuthController.logout)

  // Protected routes
  app.get('/me', { preHandler: [authMiddleware] }, AuthController.me)
  app.put('/me', { preHandler: [authMiddleware] }, AuthController.updateProfile)
}
