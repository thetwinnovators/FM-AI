import Fastify from 'fastify'

const app = Fastify({ logger: true })

app.get('/health', async () => ({ ok: true, version: '0.0.1' }))

const port = 0 // OS-assigned random port
const host = '127.0.0.1'

app.listen({ port, host }).then(() => {
  const address = app.server.address()
  if (address && typeof address === 'object') {
    console.log(`daemon listening on http://${host}:${address.port}`)
  }
})
