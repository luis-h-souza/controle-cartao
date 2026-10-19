import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildApp } from '../server/src/app.js'

// Singleton: build and ready the Fastify app once per cold start
const app = buildApp()
const appReady = app.ready()

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await appReady

  const url = req.url ?? '/'

  // Flatten headers to Record<string, string>
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers[key] = Array.isArray(value) ? value.join(', ') : value
    }
  }

  // Read body for non-GET/HEAD requests
  let payload: string | undefined
  const method = (req.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    if (typeof req.body === 'string') {
      payload = req.body
    } else if (req.body !== null && req.body !== undefined) {
      payload = JSON.stringify(req.body)
      // Ensure content-type is set for JSON payloads
      if (!headers['content-type']) {
        headers['content-type'] = 'application/json'
      }
    }
  }

  // Inject into Fastify (uses light-my-request internally)
  const response = await app.inject({
    method: method as any,
    url,
    headers,
    payload,
  })

  // Send response back through Vercel
  res.status(response.statusCode)
  for (const [key, value] of Object.entries(response.headers)) {
    if (value !== undefined) {
      res.setHeader(key, value as string | string[])
    }
  }
  res.send(response.body)
}
