import { AppError } from '@/shared/errors/app-error'

const VALID_NODE_ENVS = ['development', 'production', 'test'] as const
type ValidNodeEnv = (typeof VALID_NODE_ENVS)[number]

interface EnvConfig {
  nodeEnv: ValidNodeEnv
  databasePath: string
}

export function getDbPath(): string {
  const databasePath = process.env.DATABASE_PATH
  console.log(databasePath)
  if (!databasePath || databasePath === '') {
    throw new AppError('DATABASE_PATH is required')
  }
  return databasePath
}

export function validateEnv(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV as string

  if (!nodeEnv || nodeEnv === '') {
    throw new AppError('NODE_ENV is required')
  }

  if (!VALID_NODE_ENVS.includes(nodeEnv as ValidNodeEnv)) {
    throw new AppError(`NODE_ENV must be one of: ${VALID_NODE_ENVS.join(', ')}`)
  }

  return {
    nodeEnv: nodeEnv as ValidNodeEnv,
    databasePath: getDbPath(),
  }
}
