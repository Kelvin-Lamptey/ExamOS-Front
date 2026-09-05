import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createMockService } from '../mock/service.ts'

// Linux smoke check of the actual packaged WebKit frontend, independent of Vite.
// The child gets isolated application storage; no existing student data is used.
const temporary = await mkdtemp(join(tmpdir(), 'examos-native-smoke-'))
const service = await createMockService({
  dataDir: join(temporary, 'mock'),
  offline: true,
})
await new Promise<void>((resolve, reject) => {
  service.server.once('error', reject)
  service.server.listen(43100, '127.0.0.1', resolve)
})
let output = ''
const paths = new Set<string>()
let origin = ''
let ready!: () => void
const booted = new Promise<void>((resolve) => {
  ready = resolve
})
service.server.on('request', (request, response) => {
  paths.add(request.url ?? '')
  origin = request.headers.origin ?? origin
  if (request.url === '/v1/session') response.on('finish', ready)
})
const executable = resolve(
  process.env.EXAMOS_NATIVE_BINARY ?? 'src-tauri/target/release/exam-os',
)
const child = spawn('xvfb-run', ['-a', executable], {
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    XDG_DATA_HOME: join(temporary, 'data'),
    XDG_CONFIG_HOME: join(temporary, 'config'),
    WEBKIT_DISABLE_COMPOSITING_MODE: '1',
  },
})
child.stdout.on('data', (chunk) => {
  output = `${output}${chunk}`.slice(-8000)
})
child.stderr.on('data', (chunk) => {
  output = `${output}${chunk}`.slice(-8000)
})
const exited = new Promise<void>((resolve) =>
  child.once('exit', () => resolve()),
)
let timeout: ReturnType<typeof setTimeout> | undefined
try {
  await Promise.race([
    booted,
    new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () =>
          reject(
            new Error(
              `Native boot did not reach the local session endpoint.\n${output}`,
            ),
          ),
        20_000,
      )
    }),
    exited.then(() => {
      throw new Error(`Native process exited before boot.\n${output}`)
    }),
  ])
  console.log(
    `Native WebKit boot passed. Origin: ${origin}. Requests: ${[...paths].join(', ')}`,
  )
} finally {
  clearTimeout(timeout)
  if (child.pid && child.exitCode === null) {
    process.kill(-child.pid, 'SIGTERM')
    await exited
  }
  await service.close()
  await rm(temporary, { recursive: true, force: true })
}
