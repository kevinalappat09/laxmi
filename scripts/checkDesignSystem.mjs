import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const rendererRoot = path.join(root, 'renderer', 'src')
const uiRoot = path.join(rendererRoot, 'components', 'ui')
const visualTokenFiles = new Set([
  path.join(rendererRoot, 'styles', 'tokens.css'),
  path.join(rendererRoot, 'styles', 'themes.css'),
])
const limits = {
  rawControlsOutsideUi: 0,
  literalColorsOutsideTokens: 0,
  literalRadiiOutsideTokens: 0,
  literalShadowsOutsideTokens: 0,
  directUiImports: 0,
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(target) : target
  }))
  return files.flat()
}

function occurrences(source, expression) {
  return [...source.matchAll(expression)].length
}

function literalDeclarations(source, property) {
  const expression = new RegExp(`${property}\\s*:\\s*([^;]+);`, 'g')
  return [...source.matchAll(expression)].filter((match) => !match[1].trim().startsWith('var(')).length
}

const sourceFiles = (await listFiles(rendererRoot)).filter((file) => /\.(css|ts|tsx)$/.test(file))
const violations = []
const counts = {
  rawControlsOutsideUi: 0,
  literalColorsOutsideTokens: 0,
  literalRadiiOutsideTokens: 0,
  literalShadowsOutsideTokens: 0,
  directUiImports: 0,
}

for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8')
  const relative = path.relative(root, file)
  const insideUi = file.startsWith(`${uiRoot}${path.sep}`)

  if (!insideUi && /from\s+['"]@radix-ui\//.test(source)) {
    violations.push(`${relative}: Radix imports are restricted to renderer/src/components/ui`)
  }
  if (/components\/common\/Button|common\/Button/.test(source)) {
    violations.push(`${relative}: import Button from the shared components/ui boundary`)
  }
  if (!insideUi && /from\s+['"][^'"]*components\/ui\//.test(source)) {
    counts.directUiImports += occurrences(source, /from\s+['"][^'"]*components\/ui\//g)
  }
  if (!insideUi && /\.tsx$/.test(file)) {
    counts.rawControlsOutsideUi += occurrences(source, /<(button|input|select|textarea)\b/g)
  }
  if (/\.css$/.test(file) && !visualTokenFiles.has(file)) {
    counts.literalColorsOutsideTokens += occurrences(source, /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)
    counts.literalRadiiOutsideTokens += literalDeclarations(source, 'border-radius')
    counts.literalShadowsOutsideTokens += literalDeclarations(source, 'box-shadow')
  }
}

for (const [name, count] of Object.entries(counts)) {
  if (count > limits[name]) violations.push(`${name}: ${count} exceeds the enforced limit of ${limits[name]}`)
}

const result = { ok: violations.length === 0, counts, limits, violations }
if (process.argv.includes('--format=json')) process.stdout.write(JSON.stringify(result))
else {
  console.log('Design-system audit:', counts)
  violations.forEach((violation) => console.error(`- ${violation}`))
}
if (!result.ok) process.exitCode = 1
