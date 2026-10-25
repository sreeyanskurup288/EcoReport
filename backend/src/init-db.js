import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is missing. Copy .env.example to .env and add your PostgreSQL password.')
  process.exit(1)
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
try {
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
  await pool.query(schema)
  console.log('EcoReport tables and indexes are ready.')
} catch (error) {
  console.error('Could not initialize the database:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
