/**
 * v2.14 — Kehadiran bersama: migrasi SQL & aturan akses (RLS) diuji di
 * Postgres sungguhan (PGlite) dengan skema `auth` tiruan.
 *
 * Yang dijaga:
 *   - migrasi aman dijalankan dua kali;
 *   - 4 peran: pemilik (semua + undang + kerangka), danlat (isi + putus),
 *     pencatat (isi; putusannya dibuang server, juga lewat upsert),
 *     pengamat (baca saja);
 *   - orang asing, anon, dan email yang belum terverifikasi tidak melihat apa pun;
 *   - pemilik terakhir tidak bisa dihapus/diturunkan; tidak ada hapus keras kehadiran;
 *   - cap waktu dari server dan selalu naik.
 *
 * Jalankan: node qa/server-sql-logika.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { siapkanDb } from './server-palsu.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, ket = '') => {
  if (syarat) {
    lulus++
    console.log('  ✓ ' + nama)
  } else {
    gagal.push(nama)
    console.log('  ✗ ' + nama + (ket ? ' — ' + ket : ''))
  }
}

const db = await siapkanDb()
const q = (s, p) => db.query(s, p)
const SQL = readFileSync(fileURLToPath(new URL('../supabase/v2.14.0-kehadiran-bersama.sql', import.meta.url)), 'utf8')
let ulang = null
try {
  await db.exec(SQL)
} catch (e) {
  ulang = e.message
}
console.log('== migrasi ==')
cek('migrasi aman dijalankan ulang', ulang === null, ulang ?? '')
cek('langkah pemilik masih berupa komentar (email tidak ikut repo)', !/^insert into public\.staf_tim/m.test(SQL) && /email-pemilik@gmail\.com/.test(SQL))
cek('RLS menyala di 4 tabel', (await q(`select count(*)::int n from pg_tables where schemaname='public' and tablename in ('tim','staf_tim','kerangka','kehadiran') and rowsecurity`)).rows[0].n === 4)

const T = '00000000-0000-4000-8000-000000000001'
const U = {
  p: '11111111-1111-4111-8111-111111111111',
  d: '22222222-2222-4222-8222-222222222222',
  c: '33333333-3333-4333-8333-333333333333',
  v: '44444444-4444-4444-8444-444444444444',
  x: '55555555-5555-4555-8555-555555555555',
  f: '66666666-6666-4666-8666-666666666666',
}
await db.exec(`insert into public.tim (id, nama) values ('${T}', 'Tim Uji');
insert into public.staf_tim (tim_id, email, peran, nama) values ('${T}', 'pemilik@contoh.id', 'pemilik', 'Pemilik');
insert into auth.users values ('${U.p}','Pemilik@contoh.id',now()),('${U.d}','danlat@contoh.id',now()),('${U.c}','catat@contoh.id',now()),
  ('${U.v}','ph@contoh.id',now()),('${U.x}','asing@contoh.id',now()),('${U.f}','danlat2@contoh.id',null);`)

async function sebagai(u, f) {
  await db.exec(`set role authenticated`)
  await q(`select set_config('request.jwt.claim.sub', $1, false)`, [u])
  try {
    return await f()
  } finally {
    await db.exec(`reset role`)
    await q(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}
const galat = async (f) => {
  try {
    await f()
    return null
  } catch (e) {
    return e.message
  }
}
const UPSERT = `insert into public.kehadiran (tim_id,sesi_id,anggota_id,data) values ($1,$2,$3,$4)
  on conflict (tim_id,sesi_id,anggota_id) do update set data = excluded.data, dihapus = excluded.dihapus`

console.log('== pemilik ==')
let r = await sebagai(U.p, () => q('select * from public.tim_saya()'))
cek('tim_saya: email huruf besar tetap cocok', r.rows.length === 1 && r.rows[0].peran === 'pemilik' && r.rows[0].nama_tim === 'Tim Uji', JSON.stringify(r.rows))
cek(
  'mengundang 4 staf',
  !(await sebagai(U.p, () =>
    galat(() =>
      q(
        `insert into public.staf_tim (tim_id,email,peran) values ($1,'danlat@contoh.id','danlat'),($1,'catat@contoh.id','pencatat'),($1,'ph@contoh.id','pengamat'),($1,'danlat2@contoh.id','danlat')`,
        [T],
      ),
    ),
  )),
)
cek('email berhuruf besar ditolak', !!(await sebagai(U.p, () => galat(() => q(`insert into public.staf_tim (tim_id,email,peran) values ($1,'X@y.id','danlat')`, [T])))))
cek('peran asing ditolak', !!(await sebagai(U.p, () => galat(() => q(`insert into public.staf_tim (tim_id,email,peran) values ($1,'z@y.id','admin')`, [T])))))
cek('pemilik terakhir tak bisa dihapus', /minimal satu pemilik/.test((await sebagai(U.p, () => galat(() => q(`delete from public.staf_tim where email='pemilik@contoh.id'`)))) ?? ''))
cek('pemilik terakhir tak bisa diturunkan', /minimal satu pemilik/.test((await sebagai(U.p, () => galat(() => q(`update public.staf_tim set peran='danlat' where email='pemilik@contoh.id'`)))) ?? ''))
cek('mengirim kerangka', !(await sebagai(U.p, () => galat(() => q(`insert into public.kerangka (tim_id,jenis,id,data) values ($1,'anggota','m1','{"name":"A"}'),($1,'sesi','s1','{"title":"P1"}')`, [T])))))
r = await q(`select diubah_oleh from public.kerangka where id='m1'`)
cek('diubah_oleh diisi server', r.rows[0].diubah_oleh === U.p)
cek('jenis kerangka asing ditolak', !!(await sebagai(U.p, () => galat(() => q(`insert into public.kerangka (tim_id,jenis,id,data) values ($1,'medis','m1','{}')`, [T])))))

console.log('== danlat ==')
r = await sebagai(U.d, () => q('select * from public.tim_saya()'))
cek('danlat melihat timnya', r.rows.length === 1 && r.rows[0].peran === 'danlat')
r = await q(`select user_id, masuk_at from public.staf_tim where email='danlat@contoh.id'`)
cek('undangan ditandai sudah masuk', r.rows[0].user_id === U.d && !!r.rows[0].masuk_at)
cek('danlat tak bisa mengirim kerangka', !!(await sebagai(U.d, () => galat(() => q(`insert into public.kerangka (tim_id,jenis,id,data) values ($1,'anggota','m2','{}')`, [T])))))
r = await sebagai(U.d, () => q(`select count(*)::int n from public.kerangka`))
cek('danlat membaca kerangka', r.rows[0].n === 2)
r = await sebagai(U.d, () => q(`select email from public.staf_tim`))
cek('danlat hanya melihat barisnya sendiri', r.rows.length === 1 && r.rows[0].email === 'danlat@contoh.id')
cek('danlat tak bisa mengundang', !!(await sebagai(U.d, () => galat(() => q(`insert into public.staf_tim (tim_id,email,peran) values ($1,'z@y.id','pemilik')`, [T])))))
r = await sebagai(U.d, () => q(`update public.staf_tim set peran='pemilik' where email='danlat@contoh.id' returning 1`))
cek('danlat tak bisa menaikkan perannya sendiri', r.rows.length === 0)
cek('danlat mengisi + memutus', !(await sebagai(U.d, () => galat(() => q(UPSERT, [T, 's1', 'm1', JSON.stringify({ status: 'izin', putusanIzin: 'sah', putusanOleh: 'Danlat', sessionId: 'salah' })])))))
r = await q(`select data from public.kehadiran where anggota_id='m1'`)
cek('sessionId/memberId diselaraskan dengan kunci', r.rows[0].data.sessionId === 's1' && r.rows[0].data.memberId === 'm1')
cek('putusan danlat tersimpan', r.rows[0].data.putusanIzin === 'sah')

console.log('== pencatat ==')
await sebagai(U.c, () => q(`update public.kehadiran set data='{"status":"hadir","putusanIzin":"tidak-sah"}' where anggota_id='m1'`))
r = await q(`select data from public.kehadiran where anggota_id='m1'`)
cek('update: status masuk, putusan danlat tetap', r.rows[0].data.status === 'hadir' && r.rows[0].data.putusanIzin === 'sah' && r.rows[0].data.putusanOleh === 'Danlat', JSON.stringify(r.rows[0].data))
await sebagai(U.c, () => q(UPSERT, [T, 's1', 'm1', JSON.stringify({ status: 'alpha', putusanIzin: 'jatah', putusanCatatan: 'x' })]))
r = await q(`select data from public.kehadiran where anggota_id='m1'`)
cek('upsert: status masuk, putusan tetap', r.rows[0].data.status === 'alpha' && r.rows[0].data.putusanIzin === 'sah' && !('putusanCatatan' in r.rows[0].data), JSON.stringify(r.rows[0].data))
await sebagai(U.c, () => q(UPSERT, [T, 's1', 'm9', JSON.stringify({ status: 'izin', putusanIzin: 'sah' })]))
r = await q(`select data from public.kehadiran where anggota_id='m9'`)
cek('baris baru: putusan pencatat dibuang', r.rows[0].data.status === 'izin' && !('putusanIzin' in r.rows[0].data))
await sebagai(U.d, () => q(UPSERT, [T, 's1', 'm1', JSON.stringify({ status: 'izin' })]))
r = await q(`select data from public.kehadiran where anggota_id='m1'`)
cek('danlat membatalkan putusan', !('putusanIzin' in r.rows[0].data))

console.log('== PH & asisten ==')
r = await sebagai(U.v, () => q(`select count(*)::int n from public.kehadiran`))
cek('pengamat membaca', r.rows[0].n === 2)
cek('pengamat tak bisa menambah', !!(await sebagai(U.v, () => galat(() => q(UPSERT, [T, 's1', 'm3', '{}'])))))
r = await sebagai(U.v, () => q(`update public.kehadiran set dihapus=true returning 1`))
cek('pengamat tak bisa mengubah', r.rows.length === 0)

console.log('== orang luar ==')
r = await sebagai(U.x, () => q(`select (select count(*) from public.kehadiran)::int k, (select count(*) from public.kerangka)::int r, (select count(*) from public.tim)::int t, (select count(*) from public.staf_tim)::int s`))
cek('akun tak diundang tidak melihat apa pun', Object.values(r.rows[0]).every((n) => n === 0), JSON.stringify(r.rows[0]))
r = await sebagai(U.f, () => q('select * from public.tim_saya()'))
cek('email belum terverifikasi = bukan staf', r.rows.length === 0)
await db.exec(`set role anon`)
cek('anon ditolak', !!(await galat(() => q(`select * from public.kehadiran`))))
cek('anon tak bisa memanggil tim_saya', !!(await galat(() => q(`select * from public.tim_saya()`))))
await db.exec(`reset role`)

console.log('== lain-lain ==')
cek('hapus keras kehadiran ditolak', !!(await sebagai(U.p, () => galat(() => q(`delete from public.kehadiran`)))))
const a = await sebagai(U.d, () => q(`update public.kehadiran set data = data where anggota_id='m1' returning diubah_at`))
const b = await sebagai(U.d, () => q(`update public.kehadiran set data = data where anggota_id='m9' returning diubah_at`))
cek('diubah_at dari server dan naik', b.rows[0].diubah_at > a.rows[0].diubah_at)
cek('data kehadiran raksasa ditolak', !!(await sebagai(U.d, () => galat(() => q(UPSERT, [T, 's1', 'm5', JSON.stringify({ note: 'x'.repeat(40000) + Math.random() })])))))
await sebagai(U.p, () => q(`insert into public.staf_tim (tim_id,email,peran) values ($1,'pemilik2@contoh.id','pemilik')`, [T]))
cek('dengan dua pemilik, satu boleh turun', !(await sebagai(U.p, () => galat(() => q(`update public.staf_tim set peran='danlat' where email='pemilik2@contoh.id'`)))))

console.log(`\nRingkasan: ${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) process.exit(1)
