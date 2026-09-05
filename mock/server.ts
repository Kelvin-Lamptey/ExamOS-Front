import { resolve, join } from 'node:path'
import { rename } from 'node:fs/promises'
import { createMockService } from './service.ts'

const dataDir = resolve(process.env.EXAMOS_MOCK_DATA_DIR ?? '.mock-data')
if (process.argv.includes('--reset')) {
  const previous = join(dataDir, 'state.json')
  const archive = join(dataDir, `state.backup-${Date.now()}.json`)
  try {
    await rename(previous, archive)
    console.log(`Previous demo data archived at ${archive}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

const service = await createMockService({
  dataDir,
  offline:
    process.argv.includes('--offline') ||
    process.env.EXAMOS_MOCK_OFFLINE === '1',
})
service.server.listen(43100, '127.0.0.1', () => {
  console.log(
    `Exam OS mock service: http://127.0.0.1:43100/v1 (${service.isOffline() ? 'offline' : 'online'} simulation)`,
  )
  console.log(
    'Demo login: GCTU-CS-001 / A7K2. Data is persisted locally; no external requests are made.',
  )
  console.log(
    `PID ${process.pid}. Send SIGUSR2 to toggle simulated Internet connectivity.`,
  )
})
service.server.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
process.on('SIGUSR2', () => {
  service.setOffline(!service.isOffline())
  console.log(
    `Mock Internet is now ${service.isOffline() ? 'offline' : 'online'}. Local saves remain available.`,
  )
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void service.close().then(() => process.exit(0))
  })
}
