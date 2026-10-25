import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import connectPgSimple from 'connect-pg-simple'
import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import session from 'express-session'
import multer from 'multer'
import pg from 'pg'

const { Pool } = pg
const app = express()
const port = Number(process.env.PORT || 4000)
const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
const frontendUrl = new URL(origin)
const frontendOrigins = [frontendUrl.origin]
if (frontendUrl.hostname === 'localhost') {
  frontendUrl.hostname = '127.0.0.1'
  frontendOrigins.push(frontendUrl.origin)
} else if (frontendUrl.hostname === '127.0.0.1') {
  frontendUrl.hostname = 'localhost'
  frontendOrigins.push(frontendUrl.origin)
}
const isProduction = process.env.NODE_ENV === 'production'
if (!isProduction) frontendOrigins.push(/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/)
const uploadDir = fileURLToPath(new URL('../uploads/', import.meta.url))
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Copy backend/.env.example to backend/.env and configure it.')
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const PgSession = connectPgSimple(session)
await mkdir(uploadDir, { recursive: true })
if (isProduction) app.set('trust proxy', 1)

app.use(cors({ origin: frontendOrigins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type'] }))
app.use(express.json({ limit: '1mb' }))
app.use('/uploads', express.static(uploadDir, { maxAge: isProduction ? '1d' : 0, dotfiles: 'deny' }))
app.use(session({
  name: 'ecoreport.sid', secret: process.env.SESSION_SECRET,
  store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 },
}))

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false })
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
    ? callback(null, true)
    : callback(new Error('File type not allowed')),
})

const publicUser = row => ({ id: row.id, name: row.name, email: row.email, role: row.role, created_at: row.created_at })
const validEmail = email => typeof email === 'string' && email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
const validReportTypes = new Set(['Waste', 'Water', 'Air', 'Noise', 'Trees', 'Drainage', 'Other'])
const validSeverities = new Set(['Low', 'Medium', 'High'])
const validStatuses = new Set(['Pending', 'In Progress', 'Resolved'])

function requireUser(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ message: 'Sign in to continue.' })
  next()
}
function requireModerator(req, res, next) {
  if (!['moderator', 'admin'].includes(req.session.role)) return res.status(403).json({ message: 'Moderator permission is required.' })
  next()
}
function parseNullableNumber(value) {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}
function reportFromRow(row) {
  return {
    id: row.report_code, user_id: row.user_id, type: row.type, description: row.description,
    location: row.location, latitude: row.latitude, longitude: row.longitude, severity: row.severity,
    status: row.status, photo_url: row.photo_url, created_at: row.created_at, updated_at: row.updated_at,
    submitter: row.submitter,
  }
}
const reportSelect = `SELECT r.id, r.report_code, r.user_id, r.type, r.description, r.location, r.latitude, r.longitude,
  r.severity, r.status, r.photo_url, r.observed_on, r.created_at, r.updated_at, u.name AS submitter
  FROM reports r JOIN users u ON u.id = r.user_id`

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1')
  res.json({ status: 'ok', database: 'connected' })
})

app.post('/api/auth/signup', authLimiter, async (req, res) => {
  const { name, email, password } = req.body || {}
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (cleanName.length < 2 || cleanName.length > 100 || !validEmail(cleanEmail) || typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return res.status(400).json({ message: 'Enter a name, valid email, and password between 8 and 72 characters.' })
  }
  const passwordHash = await bcrypt.hash(password, 12)
  try {
    const { rows } = await pool.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role, created_at', [cleanName, cleanEmail, passwordHash])
    req.session.userId = rows[0].id
    req.session.role = rows[0].role
    res.status(201).json({ user: publicUser(rows[0]) })
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ message: 'An account with this email already exists.' })
    throw error
  }
})

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {}
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!validEmail(cleanEmail) || typeof password !== 'string') return res.status(400).json({ message: 'Enter a valid email and password.' })
  const { rows } = await pool.query('SELECT id, name, email, role, created_at, password_hash FROM users WHERE email = $1', [cleanEmail])
  if (!rows[0] || !(await bcrypt.compare(password, rows[0].password_hash))) return res.status(401).json({ message: 'Email or password is incorrect.' })
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()))
  req.session.userId = rows[0].id
  req.session.role = rows[0].role
  res.json({ user: publicUser(rows[0]) })
})

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error)
    res.clearCookie('ecoreport.sid', { httpOnly: true, secure: isProduction, sameSite: 'lax' })
    res.status(204).end()
  })
})

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'You are not signed in.' })
  const { rows } = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.session.userId])
  if (!rows[0]) return res.status(401).json({ message: 'Your session has expired. Sign in again.' })
  res.json({ user: publicUser(rows[0]) })
})

app.get('/api/reports', async (_req, res) => {
  const { rows } = await pool.query(`${reportSelect} ORDER BY r.created_at DESC`)
  res.json({ reports: rows.map(reportFromRow) })
})

app.get('/api/reports/:id', async (req, res) => {
  const { rows } = await pool.query(`${reportSelect} WHERE r.report_code = $1`, [req.params.id])
  if (!rows[0]) return res.status(404).json({ message: 'Report not found.' })
  const report = reportFromRow(rows[0])
  const history = await pool.query(`SELECT s.id, r.report_code AS report_id, COALESCE(u.name, 'EcoWatch team') AS changed_by,
    s.old_status, s.new_status, s.note, s.created_at FROM report_status_updates s
    JOIN reports r ON r.id = s.report_id LEFT JOIN users u ON u.id = s.changed_by
    WHERE r.report_code = $1 ORDER BY s.created_at ASC`, [req.params.id])
  report.updates = history.rows
  res.json({ report })
})

app.post('/api/reports', requireUser, photoUpload.single('photo'), async (req, res) => {
  const { type, description, location, severity = 'Medium', date } = req.body || {}
  const latitude = parseNullableNumber(req.body?.latitude)
  const longitude = parseNullableNumber(req.body?.longitude)
  if (!validReportTypes.has(type) || typeof description !== 'string' || description.trim().length < 12 || description.length > 1000 || typeof location !== 'string' || !location.trim() || location.trim().length > 180 || !validSeverities.has(severity)) {
    return res.status(400).json({ message: 'Check the issue type, description, location, and severity fields.' })
  }
  if (Number.isNaN(latitude) || Number.isNaN(longitude) || ((latitude === null) !== (longitude === null)) || (latitude !== null && (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180))) {
    return res.status(400).json({ message: 'Provide both valid latitude and longitude values, or leave both blank.' })
  }
  const observedOn = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(`INSERT INTO reports (user_id, type, description, location, latitude, longitude, severity, photo_url, observed_on)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`, [req.session.userId, type, description.trim(), location.trim(), latitude, longitude, severity, req.file ? `/uploads/${req.file.filename}` : null, observedOn])
    const reportDbId = rows[0].id
    await client.query('INSERT INTO report_status_updates (report_id, changed_by, old_status, new_status, note) VALUES ($1, $2, NULL, $3, $4)', [reportDbId, req.session.userId, 'Pending', 'Report received by the EcoWatch community.'])
    const report = await client.query(`${reportSelect} WHERE r.id = $1`, [reportDbId])
    await client.query('COMMIT')
    res.status(201).json({ report: reportFromRow(report.rows[0]) })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
})

app.patch('/api/reports/:id/status', requireUser, requireModerator, async (req, res) => {
  const { status, note = '' } = req.body || {}
  if (!validStatuses.has(status) || typeof note !== 'string' || note.length > 500) return res.status(400).json({ message: 'Choose a valid status and a note under 500 characters.' })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const current = await client.query('SELECT id, status FROM reports WHERE report_code = $1 FOR UPDATE', [req.params.id])
    if (!current.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Report not found.' }) }
    if (current.rows[0].status !== status) {
      await client.query('UPDATE reports SET status = $1, updated_at = NOW() WHERE id = $2', [status, current.rows[0].id])
      await client.query('INSERT INTO report_status_updates (report_id, changed_by, old_status, new_status, note) VALUES ($1, $2, $3, $4, $5)', [current.rows[0].id, req.session.userId, current.rows[0].status, status, note.trim() || null])
    }
    const report = await client.query(`${reportSelect} WHERE r.id = $1`, [current.rows[0].id])
    const history = await client.query(`SELECT s.id, r.report_code AS report_id, COALESCE(u.name, 'EcoWatch team') AS changed_by,
      s.old_status, s.new_status, s.note, s.created_at FROM report_status_updates s
      JOIN reports r ON r.id = s.report_id LEFT JOIN users u ON u.id = s.changed_by
      WHERE r.id = $1 ORDER BY s.created_at ASC`, [current.rows[0].id])
    await client.query('COMMIT')
    res.json({ report: { ...reportFromRow(report.rows[0]), updates: history.rows } })
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
})

app.get('/api/analytics/summary', async (_req, res) => {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending,
    COUNT(*) FILTER (WHERE status = 'In Progress')::int AS in_progress,
    COUNT(*) FILTER (WHERE status = 'Resolved')::int AS resolved
    FROM reports`)
  const category = await pool.query('SELECT type, COUNT(*)::int AS count FROM reports GROUP BY type ORDER BY count DESC')
  res.json({ summary: { ...rows[0], categories: category.rows } })
})

app.use((error, _req, res, _next) => {
  console.error(error)
  if (error instanceof multer.MulterError) return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Photo must be 5 MB or smaller.' : 'The photo could not be uploaded.' })
  if (error.message === 'File type not allowed') return res.status(400).json({ message: 'Use a JPG, PNG, or WebP photo.' })
  res.status(500).json({ message: 'The server could not complete that request. Check the backend terminal for details.' })
})

let server
try {
  await pool.query('SELECT 1')
  server = app.listen(port, () => console.log(`EcoReport API listening at http://localhost:${port}`))
} catch (error) {
  console.error(`Could not connect to PostgreSQL. Check backend/.env and make sure PostgreSQL is running: ${error.message}`)
  await pool.end()
  process.exit(1)
}
async function shutdown() { server.close(); await pool.end(); process.exit(0) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
