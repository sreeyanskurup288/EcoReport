import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
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
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    if (process.env.ADMIN_PASSWORD.length < 8) throw new Error('ADMIN_PASSWORD must contain at least 8 characters.')
    const email = process.env.ADMIN_EMAIL.trim().toLowerCase()
    const name = (process.env.ADMIN_NAME || 'EcoReport Administrator').trim().slice(0, 100)
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)
    await pool.query(`INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = 'admin'`, [name, email, passwordHash])
    console.log(`Administrator account ready for ${email}.`)
  }
  console.log('EcoReport tables and indexes are ready.')
} catch (error) {
  console.error('Could not initialize the database:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
