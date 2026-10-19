import { FastifyReply, FastifyRequest } from 'fastify'
import { verifyAccessToken, TokenPayload } from '../utils/token.js'
import { prisma } from '../config/prisma.js'

declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Token de autenticação não fornecido' })
    }

    const token = authHeader.substring(7)
    const payload = verifyAccessToken(token)

    // Optional: verify user still exists in DB
    const user = await prisma.usuario.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, nome: true },
    })

    if (!user) {
      return reply.status(401).send({ error: 'Usuário não encontrado ou inativo' })
    }

    request.user = {
      userId: user.id,
      email: user.email,
      nome: user.nome,
    }
  } catch (error) {
    return reply.status(401).send({ error: 'Token inválido ou expirado' })
  }
}
