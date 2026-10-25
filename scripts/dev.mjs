import { spawn } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const children = [
  spawn(npmCommand, ['run', 'dev:frontend'], { stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn(npmCommand, ['run', 'dev:backend'], { stdio: 'inherit', shell: process.platform === 'win32' }),
]

let shuttingDown = false
function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 250)
}

for (const child of children) {
  child.on('error', error => {
    console.error(`Could not start development process: ${error.message}`)
    shutdown(1)
  })
  child.on('exit', (code, signal) => {
    if (!shuttingDown && code !== 0 && signal !== 'SIGTERM') shutdown(code || 1)
  })
}

process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())
