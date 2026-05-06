import { AppError } from '@/shared/errors/app-error'

const VALID_NODE_ENVS = ['development', 'production', 'test'] as const
type ValidNodeEnv = (typeof VALID_NODE_ENVS)[number]

interface EnvConfig {
  nodeEnv: ValidNodeEnv
  databasePath: string
}

export function validateEnv(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV
  const databasePath = process.env.DATABASE_PATH

  if (!nodeEnv || nodeEnv === '') {
    throw new AppError('NODE_ENV is required')
  }

  if (!VALID_NODE_ENVS.includes(nodeEnv as ValidNodeEnv)) {
    throw new AppError(`NODE_ENV must be one of: ${VALID_NODE_ENVS.join(', ')}`)
  }

  if (!databasePath || databasePath === '') {
    throw new AppError('DATABASE_PATH is required')
  }

  return {
    nodeEnv,
    databasePath,
  }
}
