#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

let input = ''
for await (const chunk of process.stdin) input += chunk
let event = {}
try {
  event = JSON.parse(input || '{}')
} catch {
  process.stdout.write(JSON.stringify({ permission: 'deny', user_message: 'Could not parse hook input.' }))
  process.exit(0)
}

const command = event.command ?? ''
if (!/\bgit\s+(commit|push)\b/.test(command)) {
  process.stdout.write(JSON.stringify({ permission: 'allow' }))
  process.exit(0)
}

const audit = spawnSync(process.execPath, ['scripts/checkDesignSystem.mjs'], { encoding: 'utf8' })
if (audit.status === 0) process.stdout.write(JSON.stringify({ permission: 'allow' }))
else {
  process.stdout.write(JSON.stringify({
    permission: 'deny',
    user_message: 'Frontend design-system audit failed.',
    agent_message: `${audit.stdout}\n${audit.stderr}`.trim(),
  }))
}
