import path from 'path'
import os from 'os'
import { AppError } from '../../src/shared/errors/app-error'

export const TEST_DATABASE_FILENAME = 'kachalka.test.db'
export const DEVELOPER_DATABASE_FILENAME = 'kachalka.db'

const DATA_DIRECTORY = 'data'

interface ResolveTestDatabasePathOptions {
  checkoutRoot: string
  envDatabasePath?: string
}

function isWithinDirectory(candidate: string, directory: string): boolean {
  const relative = path.relative(directory, candidate)
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

function allowedRootsDescription(checkoutRoot: string, tempDirectory: string): string {
  return `"${checkoutRoot}" or the temporary directory "${tempDirectory}"`
}

export function resolveTestDatabasePath({
  checkoutRoot,
  envDatabasePath,
}: ResolveTestDatabasePathOptions): string {
  const root = path.resolve(checkoutRoot)
  const dataDirectory = path.join(root, DATA_DIRECTORY)
  const tempDirectory = path.resolve(os.tmpdir())
  const requested = envDatabasePath?.trim()
  const candidate = requested
    ? path.resolve(root, requested)
    : path.join(dataDirectory, TEST_DATABASE_FILENAME)

  if (candidate === path.join(dataDirectory, DEVELOPER_DATABASE_FILENAME)) {
    throw new AppError(
      `Refusing to open "${candidate}": that is the developer database, the file the ` +
        `developer's own dev server reads and writes. A unit run may only open a database ` +
        `inside ${allowedRootsDescription(root, tempDirectory)}. ` +
        `Use "${path.join(dataDirectory, TEST_DATABASE_FILENAME)}" instead.`,
    )
  }

  if (!requested) {
    return candidate
  }

  if (
    isWithinDirectory(candidate, dataDirectory) ||
    isWithinDirectory(candidate, tempDirectory)
  ) {
    return candidate
  }

  throw new AppError(
    `Refusing to open "${candidate}": that database is not owned by this checkout. A unit ` +
      `run may only open a database inside ${allowedRootsDescription(dataDirectory, tempDirectory)}.`,
  )
}
