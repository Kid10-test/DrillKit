/**
 * Pengaturan sekali: repo materi dan token GitHub.
 *
 * Token tidak pernah masuk basis data. Yang tersimpan hanya di
 * localStorage perangkat pelatih ini.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Field, Input, useToast } from './ui'
import { bacaMode } from '../lib/modePerangkat'
import {
  bacaAlamatRepo,
  bacaAtur,
  cuplikanVercel,
  kirimGithub,
  rapikanAtur,
  simpanAtur,
  ujiSambungan,
  urlMentah,
  type AturTerbit,
} from '../lib/terbit'

export function KartuTerbit() {
  const toast = useToast()
  const awal = bacaAtur()
  const [pemilik, setPemilik] = useState(awal?.pemilik ?? '')
  const [repo, setRepo] = useState(awal?.repo ?? 'drillkit-materi')
  const [cabang, setCabang] = useState(awal?.cabang ?? 'main')
  const [token, setToken] = useState('')
  const [tersimpan, setTersimpan] = useState(!!awal?.token)
  const [sedang, setSedang] = useState(false)
  const [hasil, setHasil] = useState('')
  const [baik, setBaik] = useState<boolean | null>(null)

  if (bacaMode() === 'member') return null

  function kumpulkan(): AturTerbit | null {
    const tokenPakai = token.trim() || awal?.token || ''
    const rapi = rapikanAtur({ pemilik, repo, token: tokenPakai, cabang })
    if ('salah' in rapi) {
      toast.push(rapi.salah, 'err')
      return null
    }
    return rapi
  }

  function simpan(atur: AturTerbit) {
    simpanAtur(atur)
    setTersimpan(true)
    setToken('')
  }

  async function uji() {
    const atur = kumpulkan()
    if (!atur) return
    simpan(atur)
    setSedang(true)
    setHasil('')
    try {
      const h = await ujiSambungan(atur, kirimGithub)
      setBaik(h.baik)
      setHasil(h.pesan)
      toast.push(h.pesan, h.baik ? 'ok' : 'err')
    } catch (e) {
      const pesan = e instanceof Error ? e.message : 'Gagal menghubungi GitHub.'
      setBaik(false)
      setHasil(pesan)
      toast.push(pesan, 'err')
    } finally {
      setSedang(false)
    }
  }

  function hapus() {
    simpanAtur(null)
    setTersimpan(false)
    setToken('')
    setHasil('')
    setBaik(null)
    toast.push('Token dihapus dari perangkat ini', 'info')
  }

  async function salin(teks: string) {
    try {
      await navigator.clipboard.writeText(teks)
      toast.push('Cuplikan disalin')
    } catch {
      toast.push('Tidak bisa menyalin otomatis — pilih teksnya, lalu salin', 'info')
    }
  }

  const cuplikan = cuplikanVercel({
    pemilik: pemilik.trim() || 'NAMA-GITHUB',
    repo: repo.trim() || 'drillkit-materi',
    cabang: cabang.trim() || 'main',
  })

  return (
    <Card className="lg:col-span-2" data-testid="kartu-terbit">
      <h2 className="text-sm font-semibold text-slate-200">Terbitkan ke anggota</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        Sekali saja. Setelah ini, tombol <b>Terbitkan ke anggota</b> di menu Berbagi menulis
        materi grup ke repo GitHub. Token hanya tersimpan di perangkat ini — tidak masuk backup,
        tidak masuk paket, dan tidak terlihat di mode anggota.
      </p>

      <ol className="mt-3 space-y-2 text-[11px] leading-relaxed text-slate-400">
        <li className="flex gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-200">1</span>
          <span>
            Buat repo <b className="text-slate-300">publik</b> bernama <b className="text-slate-300">drillkit-materi</b>.{' '}
            <a className="text-emerald-400 hover:underline" href="https://github.com/new" target="_blank" rel="noreferrer">
              Buka halaman repo baru
            </a>
            . Jangan centang privat.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-200">2</span>
          <span>
            Buat token <b className="text-slate-300">fine-grained</b> yang hanya berhak <b className="text-slate-300">Contents: Read and write</b> pada repo itu. Tidak perlu izin lain.{' '}
            <a
              className="text-emerald-400 hover:underline"
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noreferrer"
            >
              Buat token
            </a>
            .
          </span>
        </li>
        <li className="flex gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-200">3</span>
          <span>Tempel pemilik, nama repo, dan token di bawah.</span>
        </li>
        <li className="flex gap-2">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-200">4</span>
          <span>Tekan <b className="text-slate-300">Uji sambungan</b>. Repo privat atau token yang ditolak akan diberitahu dengan jelas.</span>
        </li>
      </ol>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Pemilik repo" hint="nama akun GitHub">
          <Input
            data-testid="pemilik-repo"
            value={pemilik}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="nama-github"
            onChange={(e) => {
              const alamat = bacaAlamatRepo(e.target.value)
              if (alamat) {
                setPemilik(alamat.pemilik)
                setRepo(alamat.repo)
              } else setPemilik(e.target.value)
            }}
          />
        </Field>
        <Field label="Nama repo" hint="boleh tempel URL GitHub">
          <Input
            data-testid="nama-repo"
            value={repo}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="drillkit-materi"
            onChange={(e) => {
              const alamat = bacaAlamatRepo(e.target.value)
              if (alamat) {
                setPemilik(alamat.pemilik)
                setRepo(alamat.repo)
              } else setRepo(e.target.value)
            }}
          />
        </Field>
        <Field label="Token" hint={tersimpan ? 'token tersimpan — kosongkan bila tidak diganti' : 'tidak akan ditampilkan lagi setelah disimpan'}>
          <Input
            data-testid="token-github"
            type="password"
            value={token}
            autoComplete="off"
            placeholder={tersimpan ? '•••• tersimpan' : 'github_pat_…'}
            onChange={(e) => setToken(e.target.value)}
          />
        </Field>
        <Field label="Cabang" hint="biasanya main">
          <Input data-testid="cabang-repo" value={cabang} onChange={(e) => setCabang(e.target.value)} />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button data-testid="uji-sambungan" variant="primary" disabled={sedang} onClick={() => void uji()}>
          {sedang ? 'Menguji…' : 'Uji sambungan'}
        </Button>
        {tersimpan && (
          <Button variant="ghost" onClick={hapus}>
            Hapus token dari perangkat ini
          </Button>
        )}
      </div>
      {hasil && (
        <p
          data-testid="hasil-uji"
          className={`mt-2 text-[11px] leading-relaxed ${baik ? 'text-emerald-300' : 'text-rose-300'}`}
        >
          {hasil}
        </p>
      )}

      <div className="mt-4 border-t border-slate-800 pt-3">
        <p className="text-xs font-medium text-slate-300">Rewrite Vercel, sekali</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Anggota tetap membuka situs yang sama dan mengambil <b>paket.json</b>. Tambahkan rewrite
          ini ke <b>vercel.json</b> — jangan menghapus rewrite yang sudah ada. Tanpa ini, mengunggah
          ulang aplikasi akan menghapus berkas materi.
        </p>
        <textarea
          data-testid="cuplikan-vercel"
          readOnly
          value={cuplikan}
          className="mt-2 h-28 w-full rounded-lg border border-slate-800 bg-slate-950 p-2 font-mono text-[11px] text-slate-300"
        />
        <p className="mt-1 break-all text-[11px] text-slate-600">{urlMentah({ pemilik: pemilik.trim() || 'NAMA-GITHUB', repo: repo.trim() || 'drillkit-materi', cabang: cabang.trim() || 'main' })}</p>
        <Button size="sm" className="mt-2" onClick={() => void salin(cuplikan)}>
          Salin cuplikan
        </Button>
        <p className="mt-2 text-[11px] text-slate-500">
          Tombol terbitnya ada di <Link className="text-emerald-400 hover:underline" to="/berbagi">menu Berbagi</Link>.
        </p>
      </div>
    </Card>
  )
}
