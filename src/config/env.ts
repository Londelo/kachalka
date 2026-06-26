import { AppError } from '@/shared/errors/app-error'
import path from 'path'

const VALID_NODE_ENVS = ['development', 'production', 'test'] as const
type ValidNodeEnv = (typeof VALID_NODE_ENVS)[number]

interface EnvConfig {
  nodeEnv: ValidNodeEnv
  databasePath: string
}

export function getDbPath(): string {
  return process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'kachalka.db')
}

export function validateEnv(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV as string
  const databasePath = getDbPath()

  if (!nodeEnv || nodeEnv === '') {
    throw new AppError('NODE_ENV is required')
  }

  if (!VALID_NODE_ENVS.includes(nodeEnv as ValidNodeEnv)) {
    throw new AppError(`NODE_ENV must be one of: ${VALID_NODE_ENVS.join(', ')}`)
  }

  return {
    nodeEnv: nodeEnv as ValidNodeEnv,
    databasePath,
  }
}
