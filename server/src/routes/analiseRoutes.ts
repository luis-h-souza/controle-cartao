import { FastifyInstance } from 'fastify'
import { AnaliseController } from '../controllers/AnaliseController.js'
import { authMiddleware } from '../middlewares/auth.js'

export async function analiseRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware)
  app.get('/', AnaliseController.monthly)
}
