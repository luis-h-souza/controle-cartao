import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'

export const createCartaoSchema = z.object({
  nome: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  bandeira: z.string().optional().default('Mastercard'),
  cor: z.string().optional().default('#6366f1'),
  limite: z.number().positive('O limite deve ser maior que zero'),
  diaFechamento: z.number().int().min(1).max(31),
  diaVencimento: z.number().int().min(1).max(31),
})

export const updateCartaoSchema = createCartaoSchema.partial()

export class CartaoController {
  static async list(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.userId

      const where = userId
        ? {
            OR: [{ usuarioId: userId }, { usuarioId: null }],
          }
        : {}

      const cartoes = await prisma.cartao.findMany({
        where,
        include: {
          gastos: {
            orderBy: { dataCompra: 'desc' },
          },
        },
        orderBy: { criadoEm: 'desc' },
      })

      // Calculate totals per card
      const enrichedCartoes = cartoes.map((cartao) => {
        const totalGasto = cartao.gastos.reduce((acc, gasto) => acc + gasto.valor, 0)
        const limiteDisponivel = Math.max(0, cartao.limite - totalGasto)
        const percentualUtilizado = cartao.limite > 0 ? (totalGasto / cartao.limite) * 100 : 0

        return {
          ...cartao,
          totalGasto,
          limiteDisponivel,
          percentualUtilizado: Math.min(100, Math.round(percentualUtilizado * 10) / 10),
          quantidadeGastos: cartao.gastos.length,
        }
      })

      return reply.send(enrichedCartoes)
    } catch (error) {
      reply.log.error(error)
      return reply.status(500).send({
        error: 'Erro ao buscar cartões. Verifique a conexão com o banco NeonDB no arquivo .env.',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  static async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params
      const userId = request.user?.userId

      const cartao = await prisma.cartao.findFirst({
        where: {
          id,
          ...(userId ? { OR: [{ usuarioId: userId }, { usuarioId: null }] } : {}),
        },
        include: {
          gastos: {
            orderBy: { dataCompra: 'desc' },
          },
        },
      })

      if (!cartao) {
        return reply.status(404).send({ error: 'Cartão não encontrado' })
      }

      const totalGasto = cartao.gastos.reduce((acc, gasto) => acc + gasto.valor, 0)
      const limiteDisponivel = Math.max(0, cartao.limite - totalGasto)
      const percentualUtilizado = cartao.limite > 0 ? (totalGasto / cartao.limite) * 100 : 0

      return reply.send({
        ...cartao,
        totalGasto,
        limiteDisponivel,
        percentualUtilizado: Math.min(100, Math.round(percentualUtilizado * 10) / 10),
      })
    } catch (error) {
      reply.log.error(error)
      return reply.status(500).send({ error: 'Erro ao obter cartão' })
    }
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = createCartaoSchema.parse(request.body)
      const userId = request.user?.userId

      const cartao = await prisma.cartao.create({
        data: {
          ...data,
          usuarioId: userId || null,
        },
      })

      return reply.status(201).send(cartao)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados inválidos', issues: error.issues })
      }
      reply.log.error(error)
      return reply.status(500).send({
        error: 'Erro ao criar cartão. Certifique-se de que a migration do NeonDB foi executada.',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  static async update(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params
      const data = updateCartaoSchema.parse(request.body)

      const cartao = await prisma.cartao.update({
        where: { id },
        data,
      })

      return reply.send(cartao)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados inválidos', issues: error.issues })
      }
      reply.log.error(error)
      return reply.status(500).send({ error: 'Erro ao atualizar cartão' })
    }
  }

  static async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params
      await prisma.cartao.delete({
        where: { id },
      })

      return reply.status(204).send()
    } catch (error) {
      reply.log.error(error)
      return reply.status(500).send({ error: 'Erro ao remover cartão' })
    }
  }
}
