import { spawn } from 'node:child_process'

const [, , command, ...args] = process.argv
const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (!command || !testDatabaseUrl) {
  process.stderr.write(
    'Usage: dotenv -e .env.example -- node scripts/with-test-database.mjs <command> [...args]\n',
  )
  process.exit(64)
}

const child = spawn(command, args, {
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  stdio: 'inherit',
})
child.on('error', (error) => {
  process.stderr.write(`${error.message}\n`)
  process.exit(1)
})
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
