import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // datasource omitido aqui: usa a URL definida no schema.prisma via DATABASE_URL
  // (prisma generate não precisa de conexão real; apenas prisma migrate precisa)
})
