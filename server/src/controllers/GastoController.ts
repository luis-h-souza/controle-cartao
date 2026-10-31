import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'

export const createGastoSchema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  valor: z.number().positive('O valor deve ser maior que zero'),
  categoria: z.string().default('Outros'),
  dataCompra: z.string().datetime().optional().or(z.string().date()).or(z.date()),
  parcelas: z.number().int().min(1).default(1),
  parcelaAtual: z.number().int().min(1).default(1),
  recorrente: z.boolean().default(false),
  status: z.string().default('FATURA_ABERTA'),
  cartaoId: z.string().uuid('ID de cartão inválido'),
})

export const updateGastoSchema = createGastoSchema.partial()

function valorParcela(gasto: { valor: number; parcelas: number; parcelaAtual: number }) {
  if (gasto.parcelaAtual > gasto.parcelas) return 0
  return gasto.parcelas > 1 ? gasto.valor / gasto.parcelas : gasto.valor
}

function saldoParcelasEmAberto(gasto: { valor: number; parcelas: number; parcelaAtual: number }) {
  const parcelasRestantes = Math.max(0, gasto.parcelas - gasto.parcelaAtual + 1)
  return valorParcela(gasto) * parcelasRestantes
}

/**
 * Calcula o período de fatura baseado no dia de fechamento.
 *
 * Convenção: "Fatura de Novembro" = a fatura que FECHA no dia diaFechamento
 * de OUTUBRO (mês anterior) e é PAGA em novembro.
 *
 * Exemplo com diaFechamento = 29:
 *   Fatura Novembro: 30/set → 29/out  (fecha 29/out, paga em nov)
 *   Fatura Dezembro: 30/out → 29/nov  (fecha 29/nov, paga em dez)
 *
 * Regra: compras NO dia de fechamento → ainda entram na fatura atual.
 *        compras no dia SEGUINTE ao fechamento → já vão para a próxima fatura.
 */
function periodoFatura(mesFatura: number, anoFatura: number, diaFechamento: number) {
  // Fim da fatura = diaFechamento do mês ANTERIOR ao mês da fatura
  let endMes = mesFatura - 1
  let endAno = anoFatura
  if (endMes <= 0) { endMes = 12; endAno -= 1 }

  const ultimoDiaEndMes = new Date(endAno, endMes, 0).getDate()
  const diaFimReal = Math.min(diaFechamento, ultimoDiaEndMes)
  const endDate = new Date(endAno, endMes - 1, diaFimReal, 23, 59, 59, 999)

  // Início da fatura = dia SEGUINTE ao diaFechamento de 2 meses atrás
  let prevMes = mesFatura - 2
  let prevAno = anoFatura
  if (prevMes <= 0) { prevMes += 12; prevAno -= 1 }

  const ultimoDiaPrevMes = new Date(prevAno, prevMes, 0).getDate()
  const diaPrevFech = Math.min(diaFechamento, ultimoDiaPrevMes)
  const startDate = new Date(prevAno, prevMes - 1, diaPrevFech)
  startDate.setDate(startDate.getDate() + 1) // dia seguinte ao fechamento anterior
  startDate.setHours(0, 0, 0, 0)

  return { startDate, endDate }
}

export class GastoController {
  static async list(
    request: FastifyRequest<{
      Querystring: {
        cartaoId?: string
        categoria?: string
        mes?: string
        ano?: string
      }
    }>,
    reply: FastifyReply
  ) {
    try {
      const { cartaoId, categoria, mes, ano } = request.query
      const userId = request.user?.userId

      const where: any = {}

      if (userId) {
        where.cartao = {
          OR: [{ usuarioId: userId }, { usuarioId: null }],
        }
      }

      if (cartaoId) {
        where.cartaoId = cartaoId
      }

      if (categoria && categoria !== 'TODAS') {
        where.categoria = categoria
      }

      if (mes && ano) {
        const mesInt = parseInt(mes, 10)
        const anoInt = parseInt(ano, 10)

        if (cartaoId) {
          // Com cartão específico, usa a regra de fechamento do cartão
          const cartao = await prisma.cartao.findUnique({
            where: { id: cartaoId },
            select: { diaFechamento: true },
          })

          if (cartao) {
            const { startDate, endDate } = periodoFatura(mesInt, anoInt, cartao.diaFechamento)
            where.dataCompra = { gte: startDate, lte: endDate }
          } else {
            // Fallback para mês calendário
            where.dataCompra = {
              gte: new Date(anoInt, mesInt - 1, 1),
              lte: new Date(anoInt, mesInt, 0, 23, 59, 59),
            }
          }
        } else {
          // Sem cartão específico: filtra por mês calendário (todos os cartões têm fechamentos diferentes)
          where.dataCompra = {
            gte: new Date(anoInt, mesInt - 1, 1),
            lte: new Date(anoInt, mesInt, 0, 23, 59, 59),
          }
        }
      }

      const gastos = await prisma.gasto.findMany({
        where,
        include: {
          cartao: {
            select: {
              id: true,
              nome: true,
              bandeira: true,
              cor: true,
              diaFechamento: true,
            },
          },
        },
        orderBy: { dataCompra: 'desc' },
      })

      return reply.send(gastos)
    } catch (error) {
      reply.log.error(error)
      return reply.status(500).send({
        error: 'Erro ao buscar gastos. Verifique a conexão com o NeonDB.',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  static async summary(
    request: FastifyRequest<{ Querystring: { cartaoId?: string; mes?: string; ano?: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { cartaoId, mes, ano } = request.query
      const userId = request.user?.userId

      const where: any = {}
      if (cartaoId) {
        where.cartaoId = cartaoId
      }
      if (userId) {
        where.cartao = {
          OR: [{ usuarioId: userId }, { usuarioId: null }],
        }
      }

      // Filtro por período de fatura quando mes/ano informados
      if (mes && ano) {
        const mesInt = parseInt(mes, 10)
        const anoInt = parseInt(ano, 10)

        if (cartaoId) {
          const cartao = await prisma.cartao.findUnique({
            where: { id: cartaoId },
            select: { diaFechamento: true },
          })
          if (cartao) {
            const { startDate, endDate } = periodoFatura(mesInt, anoInt, cartao.diaFechamento)
            where.dataCompra = { gte: startDate, lte: endDate }
          } else {
            where.dataCompra = {
              gte: new Date(anoInt, mesInt - 1, 1),
              lte: new Date(anoInt, mesInt, 0, 23, 59, 59),
            }
          }
        } else {
          where.dataCompra = {
            gte: new Date(anoInt, mesInt - 1, 1),
            lte: new Date(anoInt, mesInt, 0, 23, 59, 59),
          }
        }
      }

      const gastos = await prisma.gasto.findMany({
        where,
        include: {
          cartao: true,
        },
      })

      const totalGasto = gastos.reduce((acc, g) => acc + valorParcela(g), 0)

      // Group by category
      const porCategoriaMap = gastos.reduce<Record<string, number>>((acc, g) => {
        acc[g.categoria] = (acc[g.categoria] || 0) + valorParcela(g)
        return acc
      }, {})

      const porCategoria = Object.entries(porCategoriaMap)
        .map(([categoria, total]) => ({
          categoria,
          total,
          percentual: totalGasto > 0 ? Math.round((total / totalGasto) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.total - a.total)

      // Total limit of cards
      const cartaoWhere: any = cartaoId ? { id: cartaoId } : {}
      if (userId) {
        cartaoWhere.OR = [{ usuarioId: userId }, { usuarioId: null }]
      }

      const cartoes = await prisma.cartao.findMany({
        where: cartaoWhere,
      })
      const limiteTotal = cartoes.reduce((acc, c) => acc + c.limite, 0)
      const saldoEmAberto = gastos.reduce((acc, gasto) => acc + saldoParcelasEmAberto(gasto), 0)
      const limiteDisponivel = Math.max(0, limiteTotal - saldoEmAberto)

      return reply.send({
        totalGasto,
        limiteTotal,
        limiteDisponivel,
        percentualUtilizado: limiteTotal > 0 ? Math.round((saldoEmAberto / limiteTotal) * 1000) / 10 : 0,
        quantidadeGastos: gastos.length,
        porCategoria,
      })
    } catch (error) {
      reply.log.error(error)
      return reply.status(500).send({ error: 'Erro ao gerar resumo financeiro' })
    }
  }

  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as any
      const data = createGastoSchema.parse({
        ...body,
        valor: typeof body?.valor === 'string' ? parseFloat(body.valor) : body?.valor,
        parcelas: body?.parcelas ? parseInt(body.parcelas, 10) : 1,
        parcelaAtual: body?.parcelaAtual ? parseInt(body.parcelaAtual, 10) : 1,
        dataCompra: body?.dataCompra ? new Date(body.dataCompra) : new Date(),
      })

      if (data.parcelaAtual > data.parcelas) {
        return reply.status(400).send({ error: 'A parcela atual não pode ser maior que o total de parcelas' })
      }

      // Check if card exists
      const cartaoExists = await prisma.cartao.findUnique({
        where: { id: data.cartaoId },
      })

      if (!cartaoExists) {
        return reply.status(404).send({ error: 'Cartão de crédito informado não existe' })
      }

      const gasto = await prisma.gasto.create({
        data: {
          descricao: data.descricao,
          valor: data.valor,
          categoria: data.categoria,
          dataCompra: data.dataCompra,
          parcelas: data.parcelas,
          parcelaAtual: data.parcelaAtual,
          recorrente: data.recorrente,
          status: data.status,
          cartaoId: data.cartaoId,
        },
        include: {
          cartao: true,
        },
      })

      return reply.status(201).send(gasto)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados inválidos', issues: error.issues })
      }
      reply.log.error(error)
      return reply.status(500).send({
        error: 'Erro ao registrar gasto',
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
      const body = request.body as any
      const data = updateGastoSchema.parse({
        ...body,
        valor: body?.valor ? (typeof body.valor === 'string' ? parseFloat(body.valor) : body.valor) : undefined,
        dataCompra: body?.dataCompra ? new Date(body.dataCompra) : undefined,
      })

      const gasto = await prisma.gasto.update({
        where: { id },
        data,
        include: {
          cartao: true,
        },
      })

      return reply.send(gasto)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Dados inválidos', issues: error.issues })
      }
      reply.log.error(error)
      return reply.status(500).send({ error: 'Erro ao atualizar gasto' })
    }
  }

  static async delete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { id } = request.params
      await prisma.gasto.delete({
        where: { id },
      })

      return reply.status(204).send()
    } catch (error) {
      reply.log.error(error)
      return reply.status(500).send({ error: 'Erro ao excluir gasto' })
    }
  }
}
