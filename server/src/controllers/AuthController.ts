import { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { prisma } from '../config/prisma.js'
import {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  verifyRefreshToken,
} from '../utils/token.js'

export const registerSchema = z.object({
  nome: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
})

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(1, 'Senha é obrigatória'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
})

export const updateProfileSchema = z.object({
  nome: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres').optional(),
  email: z.string().email('E-mail inválido').optional(),
  senhaAtual: z.string().optional(),
  novaSenha: z.string().min(6, 'A nova senha deve ter pelo menos 6 caracteres').optional(),
})

export class AuthController {
  static async register(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { nome, email, senha } = registerSchema.parse(request.body)

      const existingUser = await prisma.usuario.findUnique({
        where: { email },
      })

      if (existingUser) {
        return reply.status(409).send({ error: 'Já existe um usuário cadastrado com este e-mail' })
      }

      const senhaHash = await hashPassword(senha)

      const usuario = await prisma.usuario.create({
        data: {
          nome,
          email,
          senha: senhaHash,
        },
      })

      const tokenPayload = {
        userId: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
      }

      const accessToken = generateAccessToken(tokenPayload)
      const refreshToken = generateRefreshToken(tokenPayload)

      // Save refresh token in database (expires in 7 days)
      const expiraEm = new Date()
      expiraEm.setDate(expiraEm.getDate() + 7)

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          usuarioId: usuario.id,
          expiraEm,
        },
      })

      return reply.status(201).send({
        user: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
        },
        accessToken,
        refreshToken,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.issues[0]?.message || 'Dados inválidos' })
      }
      reply.log.error(error)
      return reply.status(500).send({ error: 'Erro ao cadastrar usuário' })
    }
  }

  static async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email, senha } = loginSchema.parse(request.body)

      const usuario = await prisma.usuario.findUnique({
        where: { email },
      })

      if (!usuario) {
        return reply.status(401).send({ error: 'Credenciais inválidas' })
      }

      const senhaCorreta = await comparePassword(senha, usuario.senha)
      if (!senhaCorreta) {
        return reply.status(401).send({ error: 'Credenciais inválidas' })
      }

      const tokenPayload = {
        userId: usuario.id,
        email: usuario.email,
        nome: usuario.nome,
      }

      const accessToken = generateAccessToken(tokenPayload)
      const refreshToken = generateRefreshToken(tokenPayload)

      // Save refresh token in database (expires in 7 days)
      const expiraEm = new Date()
      expiraEm.setDate(expiraEm.getDate() + 7)

      await prisma.refreshToken.create({
        data: {
          token: refreshToken,
          usuarioId: usuario.id,
          expiraEm,
        },
      })

      return reply.send({
        user: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
        },
        accessToken,
        refreshToken,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.issues[0]?.message || 'Dados inválidos' })
      }
      reply.log.error(error)
      return reply.status(500).send({ error: 'Erro ao autenticar usuário' })
    }
  }

  static async refresh(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { refreshToken } = refreshSchema.parse(request.body)

      let payload
      try {
        payload = verifyRefreshToken(refreshToken)
      } catch {
        return reply.status(401).send({ error: 'Refresh token inválido ou expirado' })
      }

      const tokenInDb = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { usuario: true },
      })

      if (!tokenInDb || tokenInDb.expiraEm < new Date()) {
        if (tokenInDb) {
          await prisma.refreshToken.delete({ where: { id: tokenInDb.id } })
        }
        return reply.status(401).send({ error: 'Refresh token expirado ou revogado' })
      }

      // Rotate Refresh Token
      await prisma.refreshToken.delete({ where: { id: tokenInDb.id } })

      const tokenPayload = {
        userId: tokenInDb.usuario.id,
        email: tokenInDb.usuario.email,
        nome: tokenInDb.usuario.nome,
      }

      const newAccessToken = generateAccessToken(tokenPayload)
      const newRefreshToken = generateRefreshToken(tokenPayload)

      const expiraEm = new Date()
      expiraEm.setDate(expiraEm.getDate() + 7)

      await prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          usuarioId: tokenInDb.usuario.id,
          expiraEm,
        },
      })

      return reply.send({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      })
    } catch (error) {
      reply.log.error(error)
      return reply.status(500).send({ error: 'Erro ao renovar token' })
    }
  }

  static async logout(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { refreshToken } = request.body as { refreshToken?: string }

      if (refreshToken) {
        await prisma.refreshToken.deleteMany({
          where: { token: refreshToken },
        })
      }

      return reply.send({ message: 'Logout realizado com sucesso' })
    } catch (error) {
      reply.log.error(error)
      return reply.status(500).send({ error: 'Erro ao realizar logout' })
    }
  }

  static async me(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      return reply.status(401).send({ error: 'Não autorizado' })
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: request.user.userId },
      select: {
        id: true,
        nome: true,
        email: true,
        criadoEm: true,
      },
    })

    if (!usuario) {
      return reply.status(404).send({ error: 'Usuário não encontrado' })
    }

    return reply.send(usuario)
  }

  static async updateProfile(request: FastifyRequest, reply: FastifyReply) {
    try {
      if (!request.user) {
        return reply.status(401).send({ error: 'Não autorizado' })
      }

      const data = updateProfileSchema.parse(request.body)

      const usuario = await prisma.usuario.findUnique({
        where: { id: request.user.userId },
      })

      if (!usuario) {
        return reply.status(404).send({ error: 'Usuário não encontrado' })
      }

      // Check if email is already taken by another user
      if (data.email && data.email !== usuario.email) {
        const emailEmUso = await prisma.usuario.findUnique({
          where: { email: data.email },
        })
        if (emailEmUso) {
          return reply.status(409).send({ error: 'Este e-mail já está em uso por outro usuário' })
        }
      }

      // Check password change
      let novaSenhaHash: string | undefined = undefined
      if (data.novaSenha) {
        if (!data.senhaAtual) {
          return reply.status(400).send({ error: 'Informe a senha atual para definir uma nova senha' })
        }
        const senhaCorreta = await comparePassword(data.senhaAtual, usuario.senha)
        if (!senhaCorreta) {
          return reply.status(400).send({ error: 'Senha atual incorreta' })
        }
        novaSenhaHash = await hashPassword(data.novaSenha)
      }

      const updated = await prisma.usuario.update({
        where: { id: request.user.userId },
        data: {
          nome: data.nome ?? usuario.nome,
          email: data.email ?? usuario.email,
          ...(novaSenhaHash ? { senha: novaSenhaHash } : {}),
        },
        select: {
          id: true,
          nome: true,
          email: true,
          criadoEm: true,
          atualizadoEm: true,
        },
      })

      return reply.send(updated)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.issues[0]?.message || 'Dados inválidos' })
      }
      reply.log.error(error)
      return reply.status(500).send({ error: 'Erro ao atualizar dados do usuário' })
    }
  }
}
