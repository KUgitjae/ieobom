import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, extname, resolve, sep } from 'node:path'

const dbPath = process.env.DB_PATH || './data/ieobom.sqlite'
mkdirSync(dirname(dbPath), { recursive: true })
const db = new DatabaseSync(dbPath)
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS users (name TEXT PRIMARY KEY, salt TEXT, hash TEXT);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, name TEXT, expires INTEGER);
  CREATE TABLE IF NOT EXISTS stories (id TEXT PRIMARY KEY, data TEXT);
`)
const publicDir = resolve('dist')
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }

function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status })
}
function field(value, min, max) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed.length < min || trimmed.length > max) fail(`${min}~${max}자로 입력해 주세요.`)
  return trimmed
}
function state(user, extra = {}) {
  return { user, stories: db.prepare('SELECT data FROM stories').all().map(row => {
    const { votes, ...story } = JSON.parse(row.data)
    return { ...story, ratings: votes.map(vote => vote.score) }
  }), ...extra }
}
function cookie(token, age) {
  return `ieobom=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${process.env.COOKIE_SECURE === '1' ? '; Secure' : ''}`
}
async function readBody(req) {
  let raw = ''
  for await (const chunk of req.setEncoding('utf8')) {
    raw += chunk
    if (raw.length > 8192) fail('입력 길이를 초과했습니다.', 413)
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch {}
  fail('요청 형식이 올바르지 않습니다.')
}
function writeStory(action, body, user) {
  db.exec('BEGIN IMMEDIATE')
  try {
    let story
    const line = () => ({ id: randomUUID(), author: user, content: field(body.content, 1, 200) })
    if (action === 'create') {
      if (![3, 6, 10, 20, 30].includes(body.target)) fail('완성 문장 수를 선택해 주세요.')
      if (!['판타지', '일상', '미스터리', '로맨스', 'SF', '자유'].includes(body.genre)) fail('장르를 선택해 주세요.')
      story = { id: randomUUID(), title: field(body.title, 2, 60), genre: body.genre,
        target: body.target, creator: user, status: 'writing', lines: [line()],
        comments: [], votes: [], createdAt: Date.now() }
    } else {
      const row = db.prepare('SELECT data FROM stories WHERE id = ?').get(typeof body.id === 'string' ? body.id : '')
      if (!row) fail('이야기를 찾을 수 없습니다.', 404)
      story = JSON.parse(row.data)
      if (action === 'line') {
        if (story.status !== 'writing') fail('이미 완성된 이야기입니다.', 409)
        if (story.lines.at(-1).id !== body.previous) fail('새 문장이 등록됐어요. 마지막 문장을 확인하고 다시 작성해 주세요.', 409)
        if (story.lines.at(-1).author === user) fail('다른 작가의 문장을 기다려 주세요.', 409)
        story.lines.push(line())
        if (story.lines.length === story.target) story.status = 'completed'
      } else {
        if (story.status !== 'completed') fail('완성된 이야기에만 평가를 남길 수 있습니다.', 409)
        if (action === 'comment') {
          story.comments.push({ id: randomUUID(), author: user, content: field(body.content, 1, 500) })
        } else {
          if (![1, 2, 3, 4, 5].includes(body.score)) fail('별점은 1~5점입니다.')
          story.votes = story.votes.filter(vote => vote.user !== user)
          story.votes.push({ user, score: body.score })
        }
      }
    }
    db.prepare('INSERT INTO stories VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
      .run(story.id, JSON.stringify(story))
    db.exec('COMMIT')
    return story.id
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

createServer(async (req, res) => {
  const json = (data, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(JSON.stringify(data))
  }
  try {
    const path = new URL(req.url, 'http://localhost').pathname
    if (!path.startsWith('/api/')) {
      const file = resolve(publicDir, '.' + decodeURIComponent(path === '/' ? '/index.html' : path))
      if (file.startsWith(publicDir + sep) && existsSync(file) && statSync(file).isFile()) {
        res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' })
        createReadStream(file).pipe(res)
      } else json({ error: '페이지를 찾을 수 없습니다.' }, 404)
      return
    }
    const token = req.headers.cookie?.match(/(?:^|;\s*)ieobom=([a-f0-9]{64})(?:;|$)/)?.[1] || ''
    const user = db.prepare('SELECT name FROM sessions WHERE token = ? AND expires > ?')
      .get(token, Date.now())?.name || ''
    const action = path.slice(5)
    if (action === 'state' && req.method === 'GET') return json(state(user))
    if (req.method !== 'POST') fail('요청 방식을 확인해 주세요.', 405)
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') fail('JSON 요청이 필요합니다.', 415)
    const body = await readBody(req)
    if (action === 'register' || action === 'login') {
      const name = field(body.name, 1, 20)
      const password = body.password
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) fail('비밀번호는 8~128자로 입력해 주세요.')
      const account = db.prepare('SELECT salt, hash FROM users WHERE name = ?').get(name)
      if (action === 'register') {
        if (account) fail('이미 사용 중인 필명입니다.', 409)
        const salt = randomBytes(16).toString('hex')
        db.prepare('INSERT INTO users VALUES (?, ?, ?)').run(name, salt, scryptSync(password, salt, 64).toString('hex'))
      } else {
        const hash = scryptSync(password, account?.salt || 'ieobom-default-salt', 64)
        if (!account || !timingSafeEqual(hash, Buffer.from(account.hash, 'hex'))) fail('필명 또는 비밀번호를 확인해 주세요.', 401)
      }
      const nextToken = randomBytes(32).toString('hex')
      const age = 60 * 60 * 24 * 7
      db.prepare('DELETE FROM sessions WHERE expires <= ? OR token = ?').run(Date.now(), token)
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(nextToken, name, Date.now() + age * 1000)
      res.setHeader('Set-Cookie', cookie(nextToken, age))
      return json(state(name))
    }
    if (action === 'logout') {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
      res.setHeader('Set-Cookie', cookie('', 0))
      return json(state(''))
    }
    if (!['create', 'line', 'comment', 'rating'].includes(action)) fail('요청 경로를 찾을 수 없습니다.', 404)
    if (!user) fail('로그인해 주세요.', 401)
    return json(state(user, { id: writeStory(action, body, user) }))
  } catch (error) {
    if (!error.status) console.error(error)
    json({ error: error.status ? error.message : '서버 오류가 발생했습니다.' }, error.status || 500)
  }
}).listen(Number(process.env.PORT || 3000), () => console.log('이어봄 서버 실행 중'))
