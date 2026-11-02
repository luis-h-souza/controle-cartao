import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'

const criarBoletoSchema = z.object({
  descricao: z.string().trim().min(1, 'Descrição é obrigatória'),
  valorPadrao: z.number().positive('O valor deve ser maior que zero'),
  categoria: z.string().min(1).default('Outros'),
  diaVencimento: z.number().int().min(1).max(31),
  inicioMes: z.string().regex(/^[2-9]\d{3}-(0[1-9]|1[0-2])$/, 'Mês inicial inválido'),
})

const atualizarValorSchema = z.object({
  valor: z.number().positive('O valor deve ser maior que zero'),
})

const periodoSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2000).max(9999),
})

function inicioDoMes(mes: number, ano: number) {
  return new Date(Date.UTC(ano, mes - 1, 1))
}

export class BoletoController {
  static async list(
    request: FastifyRequest<{ Querystring: { mes: string; ano: string } }>,
    reply: FastifyReply
  ) {
    try {
      const userId = request.user?.userId
      if (!userId) return reply.status(401).send({ error: 'Usuário não autenticado' })

      const { mes, ano } = periodoSchema.parse(request.query)
      const fimDoMes = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999))
      const boletos = await prisma.boletoRecorrente.findMany({
        where: {
          usuarioId: userId,
          ativo: true,
          inicioEm: { lte: fimDoMes },
        },
        include: {
          ocorrencias: {
            where: { mes, ano },
            select: { valor: true },
          },
        },
        orderBy: [{ diaVencimento: 'asc' }, { descricao: 'asc' }],
      })

      return reply.send(
        boletos.map(({ ocorrencias, ...boleto }) => {
          const valorAjustado = ocorrencias[0]?.valor
          return {
            ...boleto,
            valor: valorAjustado ?? boleto.valorPadrao,
            valorAjustado: valorAjustado !== undefined,
            mes,
            ano,
          }
        })
      )
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Período inválido', issues: error.issues })
      }
      request.log.error(error)
      return reply.status(500).send({ error: 'Erro ao buscar boletos recorrentes' })
    }
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const userId = request.user?.userId
      if (!userId) return reply.status(401).send({ error: 'Usuário não autenticado' })

      const data = criarBoletoSchema.parse(request.body)
      const [ano, mes] = data.inicioMes.split('-').map(Number)
      const boleto = await prisma.boletoRecorrente.create({
        data: {
          descricao: data.descricao,
          valorPadrao: data.valorPadrao,
          categoria: data.categoria,
          diaVencimento: data.diaVencimento,
          inicioEm: inicioDoMes(mes, ano),
          usuarioId: userId,
        },
      })

      return reply.status(201).send(boleto)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados inválidos', issues: error.issues })
      }
      request.log.error(error)
      return reply.status(500).send({ error: 'Erro ao cadastrar boleto recorrente' })
    }
  }

  static async updateOccurrence(
    request: FastifyRequest<{
      Params: { id: string }
      Querystring: { mes: string; ano: string }
    }>,
    reply: FastifyReply
  ) {
    try {
      const userId = request.user?.userId
      if (!userId) return reply.status(401).send({ error: 'Usuário não autenticado' })

      const { id } = request.params
      const { mes, ano } = periodoSchema.parse(request.query)
      const { valor } = atualizarValorSchema.parse(request.body)
      const boleto = await prisma.boletoRecorrente.findFirst({
        where: { id, usuarioId: userId, ativo: true, inicioEm: { lte: inicioDoMes(mes, ano) } },
        select: { id: true },
      })

      if (!boleto) return reply.status(404).send({ error: 'Boleto recorrente não encontrado' })

      const ocorrencia = await prisma.boletoOcorrencia.upsert({
        where: { boletoId_ano_mes: { boletoId: id, ano, mes } },
        create: { boletoId: id, ano, mes, valor },
        update: { valor },
      })

      return reply.send(ocorrencia)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados inválidos', issues: error.issues })
      }
      request.log.error(error)
      return reply.status(500).send({ error: 'Erro ao ajustar o valor do boleto' })
    }
  }

  static async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const userId = request.user?.userId
      if (!userId) return reply.status(401).send({ error: 'Usuário não autenticado' })

      const { id } = request.params
      const result = await prisma.boletoRecorrente.updateMany({
        where: { id, usuarioId: userId, ativo: true },
        data: { ativo: false },
      })

      if (result.count === 0) {
        return reply.status(404).send({ error: 'Boleto recorrente não encontrado' })
      }

      return reply.status(204).send()
    } catch (error) {
      request.log.error(error)
      return reply.status(500).send({ error: 'Erro ao encerrar boleto recorrente' })
    }
  }
}
