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
async function ensureAccount({ email, password, name, role }) {
  if (!email || !password) return null
  if (password.length < 8) throw new Error(`${role.toUpperCase()}_PASSWORD must contain at least 8 characters.`)
  const passwordHash = await bcrypt.hash(password, 12)
  const { rows } = await pool.query(`INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
    RETURNING id, email, role`, [name.trim().slice(0, 100), email.trim().toLowerCase(), passwordHash, role])
  return rows[0]
}
try {
  const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8')
  await pool.query(schema)
  const admin = await ensureAccount({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, name: process.env.ADMIN_NAME || 'EcoReport Administrator', role: 'admin' })
  const demoUser = await ensureAccount({ email: process.env.DEMO_USER_EMAIL, password: process.env.DEMO_USER_PASSWORD, name: process.env.DEMO_USER_NAME || 'Demo Reporter', role: 'user' })
  if (admin) console.log(`Administrator account ready for ${admin.email}.`)
  if (demoUser && process.env.SEED_DEMO_DATA === 'true') {
    const trialReports = [
      ['ER-DEMO-01', 'Waste', 'Overflowing bins are blocking the park entrance and need collection.', 'Carter Road, Bandra West', 'https://www.google.com/maps/search/?api=1&query=Carter+Road+Bandra+West', 19.0596, 72.8295, 'High', 'In Progress'],
      ['ER-DEMO-02', 'Water', 'A public tap is leaking continuously and water is pooling on the footpath.', 'Lake Road, Powai', 'https://www.google.com/maps/search/?api=1&query=Lake+Road+Powai', 19.1176, 72.9060, 'Medium', 'Pending'],
      ['ER-DEMO-03', 'Trees', 'Several young roadside trees have been damaged near the community garden.', 'Hiranandani Gardens, Powai', 'https://www.google.com/maps/search/?api=1&query=Hiranandani+Gardens+Powai', 19.1197, 72.9050, 'Low', 'Resolved'],
    ]
    for (const [code, type, description, location, gmapsUrl, latitude, longitude, severity, status] of trialReports) {
      const inserted = await pool.query(`INSERT INTO reports (report_code, user_id, type, description, location, gmaps_url, latitude, longitude, severity, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (report_code) DO NOTHING RETURNING id`, [code, demoUser.id, type, description, location, gmapsUrl, latitude, longitude, severity, status])
      if (inserted.rows[0]) await pool.query('INSERT INTO report_status_updates (report_id, changed_by, old_status, new_status, note) VALUES ($1, $2, NULL, $3, $4)', [inserted.rows[0].id, demoUser.id, status, 'Trial report seeded for EcoReport demo.'])
    }
    console.log('Demo user and trial reports are ready.')
  }
  console.log('EcoReport tables and indexes are ready.')
} catch (error) {
  console.error('Could not initialize the database:', error.message)
  process.exitCode = 1
} finally {
  await pool.end()
}
