import fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'

import { resolve } from 'node:path'

import { uploadRoutes } from './routes/upload'

const app = fastify()

app.register(multipart)

// Making the uploads folder available publically
// eslint-disable-next-line @typescript-eslint/no-var-requires
app.register(require('@fastify/static'), {
  root: resolve(__dirname, '../uploads'),
  prefix: '/uploads',
})

app.register(cors, { origin: ['http://localhost:3000'] })

app.register(uploadRoutes)

app
  .listen({
    port: 3333,
    host: 'localhost',
  })
  .then(() => {
    console.log('🚀 HTTP server running on http://localhost:3333')
  })
