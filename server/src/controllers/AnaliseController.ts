import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import { parcelaNaFatura } from '../utils/fatura.js'

const periodoSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2000).max(9999),
})

type TotalPorChave = { nome: string; total: number }

function adicionarTotal(totais: Map<string, number>, chave: string, valor: number) {
  totais.set(chave, (totais.get(chave) || 0) + valor)
}

export class AnaliseController {
  static async monthly(
    request: FastifyRequest<{ Querystring: { mes: string; ano: string } }>,
    reply: FastifyReply
  ) {
    try {
      const userId = request.user?.userId
      if (!userId) return reply.status(401).send({ error: 'Usuário não autenticado' })

      const { mes, ano } = periodoSchema.parse(request.query)
      const meses = Array.from({ length: 6 }, (_, index) => {
        const data = new Date(Date.UTC(ano, mes - 1 - (5 - index), 1))
        return { mes: data.getUTCMonth() + 1, ano: data.getUTCFullYear() }
      })
      const fimDoPeriodo = new Date(Date.UTC(ano, mes, 0, 23, 59, 59, 999))
      const periodosSql = meses.map(({ mes: mesPeriodo, ano: anoPeriodo }) => ({
        mes: mesPeriodo,
        ano: anoPeriodo,
      }))

      const [gastos, boletos] = await Promise.all([
        prisma.gasto.findMany({
          where: {
            dataCompra: { lte: fimDoPeriodo },
            cartao: { OR: [{ usuarioId: userId }, { usuarioId: null }] },
          },
          include: {
            cartao: {
              select: {
                id: true,
                nome: true,
                cor: true,
                diaFechamento: true,
                diaVencimento: true,
              },
            },
          },
        }),
        prisma.boletoRecorrente.findMany({
          where: { usuarioId: userId, inicioEm: { lte: fimDoPeriodo } },
          include: {
            ocorrencias: {
              where: { OR: periodosSql },
              select: { mes: true, ano: true, valor: true },
            },
          },
        }),
      ])

      const historico = meses.map((periodo) => {
        const porCategoria = new Map<string, number>()
        const cartoesTotais = new Map<string, { nome: string; cor: string | null; total: number }>()
        let totalCartoes = 0
        let totalBoletos = 0
        let totalVencimentoAteDia15 = 0
        let totalVencimentoDia16EmDiante = 0

        for (const gasto of gastos) {
          const parcela = parcelaNaFatura(gasto, periodo.mes, periodo.ano)
          if (parcela === null) continue

          const valor = gasto.parcelas > 1 ? gasto.valor / gasto.parcelas : gasto.valor
          totalCartoes += valor
          if (gasto.cartao.diaVencimento <= 15) {
            totalVencimentoAteDia15 += valor
          } else {
            totalVencimentoDia16EmDiante += valor
          }
          adicionarTotal(porCategoria, gasto.categoria, valor)
          const cartaoAtual = cartoesTotais.get(gasto.cartao.id) || {
            nome: gasto.cartao.nome,
            cor: gasto.cartao.cor,
            total: 0,
          }
          cartoesTotais.set(gasto.cartao.id, { ...cartaoAtual, total: cartaoAtual.total + valor })
        }

        for (const boleto of boletos) {
          const inicio = new Date(boleto.inicioEm)
          const inicioDoPeriodo = new Date(Date.UTC(periodo.ano, periodo.mes - 1, 1))
          if (
            inicio.getUTCFullYear() > periodo.ano ||
            (inicio.getUTCFullYear() === periodo.ano && inicio.getUTCMonth() + 1 > periodo.mes) ||
            (boleto.encerradoEm !== null && boleto.encerradoEm <= inicioDoPeriodo)
          ) {
            continue
          }

          const ocorrencia = boleto.ocorrencias.find(
            (item) => item.mes === periodo.mes && item.ano === periodo.ano
          )
          const valor = ocorrencia?.valor ?? boleto.valorPadrao
          totalBoletos += valor
          if (boleto.diaVencimento <= 15) {
            totalVencimentoAteDia15 += valor
          } else {
            totalVencimentoDia16EmDiante += valor
          }
          adicionarTotal(porCategoria, boleto.categoria, valor)
        }

        const porCategoriaOrdenado: TotalPorChave[] = Array.from(porCategoria, ([nome, total]) => ({
          nome,
          total,
        })).sort((a, b) => b.total - a.total)
        const porCartao = Array.from(cartoesTotais, ([id, cartao]) => ({ id, ...cartao })).sort(
          (a, b) => b.total - a.total
        )

        return {
          ...periodo,
          total: totalCartoes + totalBoletos,
          totalCartoes,
          totalBoletos,
          totalVencimentoAteDia15,
          totalVencimentoDia16EmDiante,
          porCategoria: porCategoriaOrdenado,
          porCartao,
        }
      })

      return reply.send({ meses: historico })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Período inválido', issues: error.issues })
      }
      request.log.error(error)
      return reply.status(500).send({ error: 'Erro ao gerar análise financeira' })
    }
  }
}
