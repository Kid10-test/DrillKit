/**
 * v2.14 — Supabase tiruan untuk uji kehadiran bersama.
 *
 * Bukan tiruan kosong: datanya Postgres sungguhan (PGlite, Postgres dalam
 * WebAssembly) yang menjalankan berkas migrasi yang sama dengan yang ditempel
 * pelatih di Supabase — tabel, pemicu, dan aturan RLS-nya. Yang ditiru hanya
 * lapisan HTTP-nya: potongan PostgREST (`/rest/v1`) dan Auth (`/auth/v1`) yang
 * benar-benar dipakai `supabase-js` di DrillKit.
 *
 * Token akses = JWT tanpa tanda tangan berisi `sub` & `email`; server ini
 * memercayainya (ini uji, bukan pengaman). Setiap permintaan dijalankan
 * sebagai peran `authenticated` dengan `request.jwt.claim.sub` = pemakainya,
 * persis seperti Supabase, sehingga RLS yang diuji adalah RLS yang dipasang.
 */
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const SQL = fileURLToPath(new URL('../supabase/v2.14.0-kehadiran-bersama.sql', import.meta.url))

/** Postgres + skema `auth` tiruan + migrasi v2.14.0. */
export async function siapkanDb() {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant usage on schema public to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `)
  await db.exec(readFileSync(SQL, 'utf8'))
  return db
}

/** JWT tanpa tanda tangan — cukup untuk supabase-js membaca `sub`/`exp`. */
export function tokenUji(user) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 3600
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp })}.uji`
}

/** Sesi seperti yang disimpan supabase-js di localStorage. */
export function sesiUji(user) {
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 3600
  return {
    access_token: tokenUji(user),
    refresh_token: `segar-${user.id}`,
    token_type: 'bearer',
    expires_in: 30 * 24 * 3600,
    expires_at: exp,
    user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: { provider: 'google' }, user_metadata: {}, created_at: new Date().toISOString() },
  }
}

const KOLOM = /^[a-z_]+$/
const TABEL = new Set(['tim', 'staf_tim', 'kerangka', 'kehadiran'])
const JSONB = new Set(['data'])

function filterDari(params) {
  const syarat = []
  const nilai = []
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'on_conflict', 'columns', 'offset'].includes(k)) continue
    if (!KOLOM.test(k)) throw Object.assign(new Error(`kolom ${k}`), { status: 400 })
    const titik = v.indexOf('.')
    const op = v.slice(0, titik)
    const isi = v.slice(titik + 1)
    if (op === 'eq' || op === 'gt' || op === 'gte' || op === 'lt') {
      nilai.push(isi)
      syarat.push(`${k} ${{ eq: '=', gt: '>', gte: '>=', lt: '<' }[op]} $${nilai.length}`)
    } else if (op === 'in') {
      const daftar = isi
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map((x) => x.replace(/^"|"$/g, ''))
      const tanda = daftar.map((x) => {
        nilai.push(x)
        return `$${nilai.length}`
      })
      syarat.push(tanda.length ? `${k} in (${tanda.join(',')})` : 'false')
    } else throw Object.assign(new Error(`operator ${op}`), { status: 400 })
  }
  return { syarat, nilai }
}

function galatPg(e) {
  const kode = e.code ?? ''
  const status = kode === '23505' ? 409 : kode === '42501' ? 403 : kode === 'P0001' ? 400 : e.status ?? 400
  return { status, body: { code: kode || 'PGRST000', message: e.message, details: e.detail ?? null, hint: null } }
}

/**
 * Jalankan server HTTP tiruan. `pemakai` = peta kode masuk → user, untuk
 * menukar `?code=` dari halaman Google tiruan.
 */
export async function mulaiServerPalsu(db, { port = 0, kodeMasuk = {} } = {}) {
  const permintaan = []
  let antre = Promise.resolve()
  const serial = (f) => {
    const p = antre.then(f, f)
    antre = p.catch(() => undefined)
    return p
  }

  async function sebagai(sub, f) {
    await db.exec(`set role authenticated`)
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub ?? ''])
    try {
      return await f()
    } finally {
      await db.exec(`reset role`)
      await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
    }
  }

  function subDari(req) {
    const a = req.headers.authorization ?? ''
    const t = a.replace(/^Bearer\s+/i, '')
    const bagian = t.split('.')
    if (bagian.length !== 3) return null
    try {
      return JSON.parse(Buffer.from(bagian[1], 'base64url').toString()).sub ?? null
    } catch {
      return null
    }
  }

  async function rest(req, url, body) {
    const jalur = url.pathname.replace(/^\/rest\/v1\//, '')
    const sub = subDari(req)
    if (!sub) return { status: 401, body: { code: 'PGRST301', message: 'JWT tidak ada' } }
    if (jalur.startsWith('rpc/')) {
      const fn = jalur.slice(4)
      if (fn !== 'tim_saya') return { status: 404, body: { code: 'PGRST202', message: `Could not find the function ${fn}` } }
      const r = await sebagai(sub, () => db.query(`select * from public.tim_saya()`))
      return { status: 200, body: r.rows }
    }
    if (!TABEL.has(jalur)) return { status: 404, body: { code: 'PGRST205', message: `Could not find the table ${jalur}` } }
    const p = url.searchParams
    if (req.method === 'GET' || req.method === 'HEAD') {
      const kolom = (p.get('select') ?? '*').split(',').filter((k) => k === '*' || KOLOM.test(k))
      const { syarat, nilai } = filterDari(p)
      let q = `select ${kolom.join(',')} from public.${jalur}`
      if (syarat.length) q += ` where ${syarat.join(' and ')}`
      const order = p.get('order')
      if (order) {
        const [k, arah] = order.split('.')
        if (KOLOM.test(k)) q += ` order by ${k} ${arah === 'desc' ? 'desc' : 'asc'}`
      }
      const limit = Number(p.get('limit'))
      if (limit > 0) q += ` limit ${Math.min(limit, 1000)}`
      const r = await sebagai(sub, () => db.query(q, nilai))
      return { status: 200, body: r.rows.map((b) => ({ ...b, diubah_at: b.diubah_at instanceof Date ? b.diubah_at.toISOString() : b.diubah_at, masuk_at: b.masuk_at instanceof Date ? b.masuk_at.toISOString() : b.masuk_at })) }
    }
    if (req.method === 'POST') {
      const baris = Array.isArray(body) ? body : [body]
      if (!baris.length) return { status: 201, body: null }
      const kolom = [...new Set(baris.flatMap((b) => Object.keys(b)))].filter((k) => KOLOM.test(k))
      const nilai = []
      const tuple = baris.map(
        (b) =>
          `(${kolom
            .map((k) => {
              const v = b[k]
              nilai.push(v === undefined ? null : JSONB.has(k) ? JSON.stringify(v) : v)
              return `$${nilai.length}`
            })
            .join(',')})`,
      )
      let q = `insert into public.${jalur} (${kolom.join(',')}) values ${tuple.join(',')}`
      const konflik = p.get('on_conflict')
      const prefer = req.headers.prefer ?? ''
      if (konflik && /merge-duplicates/.test(prefer)) {
        const kunci = konflik.split(',').filter((k) => KOLOM.test(k))
        const ubah = kolom.filter((k) => !kunci.includes(k))
        q += ` on conflict (${kunci.join(',')}) do update set ${ubah.map((k) => `${k} = excluded.${k}`).join(', ')}`
      }
      await sebagai(sub, () => db.query(q, nilai))
      return { status: 201, body: null }
    }
    if (req.method === 'PATCH' || req.method === 'DELETE') {
      const { syarat, nilai } = filterDari(p)
      let q
      if (req.method === 'PATCH') {
        const set = Object.keys(body ?? {})
          .filter((k) => KOLOM.test(k))
          .map((k) => {
            nilai.push(JSONB.has(k) ? JSON.stringify(body[k]) : body[k])
            return `${k} = $${nilai.length}`
          })
        q = `update public.${jalur} set ${set.join(', ')}`
      } else q = `delete from public.${jalur}`
      if (syarat.length) q += ` where ${syarat.join(' and ')}`
      await sebagai(sub, () => db.query(q, nilai))
      return { status: 204, body: null }
    }
    return { status: 405, body: { message: 'metode' } }
  }

  async function auth(req, url, body) {
    const jalur = url.pathname.replace(/^\/auth\/v1\//, '')
    if (jalur === 'token' && url.searchParams.get('grant_type') === 'pkce') {
      const user = kodeMasuk[body?.auth_code]
      if (!user || !body?.code_verifier) return { status: 400, body: { error: 'invalid_grant', error_description: 'invalid flow state, no valid flow state found', code: 'flow_state_not_found' } }
      return { status: 200, body: sesiUji(user) }
    }
    if (jalur === 'token' && url.searchParams.get('grant_type') === 'refresh_token') {
      return { status: 400, body: { error: 'invalid_grant', error_description: 'Refresh token tidak dikenal' } }
    }
    if (jalur === 'user') {
      const sub = subDari(req)
      const r = await db.query(`select id, email from auth.users where id = $1`, [sub])
      if (!r.rows[0]) return { status: 401, body: { message: 'user tidak ada' } }
      return { status: 200, body: sesiUji(r.rows[0]).user }
    }
    if (jalur === 'logout') return { status: 204, body: null }
    return { status: 404, body: { message: `auth ${jalur}` } }
  }

  const server = http.createServer((req, res) => {
    const kirim = (status, body) => {
      res.writeHead(status, {
        'access-control-allow-origin': req.headers.origin ?? '*',
        'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '*',
        'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS,HEAD',
        'access-control-expose-headers': 'content-range',
        'content-type': 'application/json',
      })
      res.end(body == null ? '' : JSON.stringify(body))
    }
    if (req.method === 'OPTIONS') return kirim(204, null)
    let isi = ''
    req.on('data', (c) => (isi += c))
    req.on('end', () => {
      const url = new URL(req.url, 'http://palsu')
      permintaan.push(`${req.method} ${url.pathname}`)
      let body = null
      try {
        body = isi ? JSON.parse(isi) : null
      } catch {
        body = null
      }
      serial(async () => {
        try {
          if (url.pathname.startsWith('/rest/v1/')) return await rest(req, url, body)
          if (url.pathname.startsWith('/auth/v1/')) return await auth(req, url, body)
          return { status: 404, body: { message: 'tidak ada' } }
        } catch (e) {
          return galatPg(e)
        }
      }).then(({ status, body: b }) => kirim(status, b))
    })
  })
  await new Promise((r) => server.listen(port, '127.0.0.1', r))
  const alamat = `http://127.0.0.1:${server.address().port}`
  return { alamat, permintaan, tutup: () => new Promise((r) => server.close(r)) }
}

/** Tambah pemakai (email terverifikasi) dan kembalikan objeknya. */
export async function tambahPemakai(db, id, email) {
  await db.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [id, email])
  return { id, email }
}
