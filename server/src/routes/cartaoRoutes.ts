import { FastifyInstance } from 'fastify'
import { CartaoController } from '../controllers/CartaoController.js'
import { authMiddleware } from '../middlewares/auth.js'

export async function cartaoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware)

  app.get('/', CartaoController.list)
  app.get('/:id', CartaoController.getById)
  app.post('/', CartaoController.create)
  app.put('/:id', CartaoController.update)
  app.delete('/:id', CartaoController.delete)
}
