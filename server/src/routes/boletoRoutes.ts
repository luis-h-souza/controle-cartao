import { FastifyInstance } from 'fastify'
import { BoletoController } from '../controllers/BoletoController.js'
import { authMiddleware } from '../middlewares/auth.js'

export async function boletoRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware)

  app.get('/', BoletoController.list)
  app.post('/', BoletoController.create)
  app.put('/:id/ocorrencia', BoletoController.updateOccurrence)
  app.delete('/:id', BoletoController.delete)
}
