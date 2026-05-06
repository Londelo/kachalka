import { getDatabase } from '@/config/db'

const SEED_USERS = ['Bruno', 'Viktor', 'Kara']

export function seedDatabase(): void {
  const db = getDatabase()

  const existing = db
    .prepare('SELECT name FROM users')
    .all() as { name: string }[]

  const existingNames = new Set(existing.map((u) => u.name))
  const toInsert = SEED_USERS.filter((name) => !existingNames.has(name))

  if (toInsert.length === 0) return

  const insert = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)')

  const run = db.transaction((names: string[]) => {
    for (const name of names) {
      insert.run(name, '')
    }
  })

  run(toInsert)
}
