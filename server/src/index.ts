import 'dotenv/config'
import { buildApp } from './app.js'

const app = buildApp()

const PORT = Number(process.env.PORT) || 3333

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`🚀 Servidor Fastify rodando em http://localhost:${PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
