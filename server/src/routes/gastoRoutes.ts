import { FastifyInstance } from 'fastify'
import { GastoController } from '../controllers/GastoController.js'
import { authMiddleware } from '../middlewares/auth.js'

export async function gastoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware)

  app.get('/', GastoController.list)
  app.get('/resumo', GastoController.summary)
  app.post('/', GastoController.create)
  app.put('/:id', GastoController.update)
  app.delete('/:id', GastoController.delete)
}
