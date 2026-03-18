import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const vite = spawn('node', ['node_modules/vite/bin/vite.js'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})

const api = spawn('node', ['node_modules/tsx/dist/cli.mjs', 'scripts/dev-api.ts'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
})

function killAll() {
  vite.kill()
  api.kill()
  process.exit(0)
}

process.on('SIGINT', killAll)
process.on('SIGTERM', killAll)
