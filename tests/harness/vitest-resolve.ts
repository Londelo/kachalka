import { readFileSync, statSync } from 'fs'
import { createRequire } from 'module'
import path from 'path'

export const JEST_DOM_VITEST_SPECIFIER = '@testing-library/jest-dom/vitest'

const NODE_MODULES_DIRECTORY = 'node_modules'
const PACKAGE_MANIFEST = 'package.json'
const RESOLUTION_ANCHOR = 'harness-anchor.js'
const PREFERRED_EXPORT_CONDITIONS = ['import', 'node', 'default']

function isDirectory(candidate: string): boolean {
  try {
    return statSync(candidate).isDirectory()
  } catch {
    return false
  }
}

function isFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile()
  } catch {
    return false
  }
}

function nearestDirectoryWithNodeModules(startingDirectory: string): string | undefined {
  let current = path.resolve(startingDirectory)

  while (current !== path.parse(current).root) {
    if (isDirectory(path.join(current, NODE_MODULES_DIRECTORY))) {
      return current
    }
    current = path.dirname(current)
  }

  return undefined
}

function splitSpecifier(specifier: string): { packageName: string; subpath: string } {
  const segments = specifier.split('/')
  const isScoped = segments[0].startsWith('@')

  return {
    packageName: segments.slice(0, isScoped ? 2 : 1).join('/'),
    subpath: segments.length > (isScoped ? 2 : 1) ? `./${segments.slice(isScoped ? 2 : 1).join('/')}` : '.',
  }
}

function nearestPackageManifest(fromFile: string): string | undefined {
  let current = path.dirname(path.resolve(fromFile))

  while (current !== path.parse(current).root) {
    const candidate = path.join(current, PACKAGE_MANIFEST)
    if (isFile(candidate)) {
      return candidate
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return undefined
    }
    current = parent
  }

  return undefined
}

function readExportsField(manifestPath: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8')) as { exports?: unknown }
    const exportsField = parsed.exports

    return typeof exportsField === 'object' && exportsField !== null && !Array.isArray(exportsField)
      ? (exportsField as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

function pickExportTarget(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(pickExportTarget).find((target) => target !== undefined)
  }

  if (typeof value === 'object' && value !== null) {
    const conditions = value as Record<string, unknown>

    for (const condition of PREFERRED_EXPORT_CONDITIONS) {
      if (Object.hasOwn(conditions, condition)) {
        const target = pickExportTarget(conditions[condition])
        if (target !== undefined) {
          return target
        }
      }
    }
  }

  return undefined
}

function requireResolvedEntry(root: string, specifier: string): string {
  const requireFromRoot = createRequire(path.join(root, RESOLUTION_ANCHOR))

  try {
    return requireFromRoot.resolve(specifier)
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Cannot resolve "${specifier}" from "${root}": ${reason}`, { cause })
  }
}

function existingFileOrThrow(candidate: string, root: string, specifier: string, detail: string): string {
  if (!isFile(candidate)) {
    throw new Error(`Cannot resolve "${specifier}" from "${root}": ${detail}`)
  }

  return candidate
}

function resolveEntryFromRoot(root: string, specifier: string): string {
  const nodeResolved = requireResolvedEntry(root, specifier)
  const manifestPath = nearestPackageManifest(nodeResolved)

  if (!manifestPath) {
    return existingFileOrThrow(nodeResolved, root, specifier, `"${nodeResolved}" is not a file.`)
  }

  const packageDirectory = path.dirname(manifestPath)
  const exportsField = readExportsField(manifestPath)

  if (!exportsField) {
    return existingFileOrThrow(nodeResolved, root, specifier, `"${nodeResolved}" is not a file.`)
  }

  const { packageName, subpath } = splitSpecifier(specifier)
  const target = exportsField[subpath] === undefined ? undefined : pickExportTarget(exportsField[subpath])

  if (target === undefined || !target.startsWith('./')) {
    return existingFileOrThrow(nodeResolved, root, specifier, `"${nodeResolved}" is not a file.`)
  }

  const esmEntry = path.resolve(packageDirectory, target)

  return existingFileOrThrow(
    esmEntry,
    root,
    specifier,
    `"${packageDirectory}" declares "${target}" as the import entry of "${packageName}", but no such file exists.`,
  )
}

export function resolveSetupFiles(root: string): string[] {
  return [resolveEntryFromRoot(path.resolve(root), JEST_DOM_VITEST_SPECIFIER)]
}

export function resolveServerFsAllow(root: string): string[] {
  const checkoutRoot = path.resolve(root)
  const inheritedRoot = nearestDirectoryWithNodeModules(checkoutRoot)

  return [...new Set(inheritedRoot ? [checkoutRoot, inheritedRoot] : [checkoutRoot])]
}
