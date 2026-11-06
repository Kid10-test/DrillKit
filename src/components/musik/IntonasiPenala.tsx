import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Select, useToast } from '../ui'
import type { HasilNada } from '../../lib/tuner'
import {
  DAFTAR_TANGGA_PETA,
  JENDELA_JEJAK_MS,
  JENJANG_TOLERANSI,
  WILAYAH_PETA,
  analisisJejak,
  bacaDaftarPeta,
  cariTanggaPeta,
  cariWilayah,
  hapusPeta,
  labelNadaPeta,
  nadaSasaranPeta,
  proyeksiJejak,
  ringkasPeta,
  ringkasSampelNada,
  saranKecenderungan,
  simpanPeta,
  SYARAT_SAMPEL,
  warnaSen,
  wilayahBawaan,
  type IdToleransi,
  type NadaPeta,
  type PetaKecenderungan,
  type SampelPeta,
  type TitikJejak,
} from '../../lib/intonasi'
import { downloadHtmlFile, printHtml } from '../../lib/print'

/* ============================================================================
 * #29 — Grafik kestabilan nada bergulir + 3 jenjang toleransi
 * ========================================================================== */

/**
 * Kanvas jejak sen 8 detik terakhir (#hex murni). Sumbu tegak −50…+50 sen,
 * pita hijau = toleransi jenjang yang dipilih. Garis terputus saat hening
 * atau ganti nada, jadi *scoop*, goyangan, dan ekor turun terlihat jelas.
 */
function GrafikJejakNada({ jejak, tol, sekarang }: { jejak: TitikJejak[]; tol: number; sekarang: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.max(200, Math.round(c.clientWidth || 300))
    const h = 120
    if (c.width !== w * dpr) c.width = w * dpr
    if (c.height !== h * dpr) c.height = h * dpr
    const g = c.getContext('2d')
    if (!g) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.fillStyle = '#0b1120'
    g.fillRect(0, 0, w, h)
    const y = (sen: number) => h / 2 - (Math.max(-50, Math.min(50, sen)) / 50) * (h / 2)
    // Pita toleransi.
    g.fillStyle = '#10b98126'
    g.fillRect(0, y(tol), w, y(-tol) - y(tol))
    // Garis bantu ±25 & 0.
    g.strokeStyle = '#1e293b'
    g.lineWidth = 1
    for (const s of [-25, 25]) {
      g.beginPath()
      g.moveTo(0, y(s))
      g.lineTo(w, y(s))
      g.stroke()
    }
    g.strokeStyle = '#475569'
    g.beginPath()
    g.moveTo(0, h / 2)
    g.lineTo(w, h / 2)
    g.stroke()
    // Garis tiap detik.
    g.strokeStyle = '#111c33'
    for (let d = 1; d < JENDELA_JEJAK_MS / 1000; d++) {
      const x = (d / (JENDELA_JEJAK_MS / 1000)) * w
      g.beginPath()
      g.moveTo(x, 0)
      g.lineTo(x, h)
      g.stroke()
    }
    // Jejak.
    const titik = proyeksiJejak(jejak, sekarang, w, h)
    g.lineWidth = 2.2
    g.lineCap = 'round'
    let sebelum: { x: number; y: number; sen: number } | null = null
    for (const p of titik) {
      if (!p) {
        sebelum = null
        continue
      }
      if (sebelum) {
        g.strokeStyle = warnaSen(p.sen, tol)
        g.beginPath()
        g.moveTo(sebelum.x, sebelum.y)
        g.lineTo(p.x, p.y)
        g.stroke()
      } else {
        g.fillStyle = warnaSen(p.sen, tol)
        g.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4)
      }
      sebelum = p
    }
    // Label sumbu.
    g.fillStyle = '#64748b'
    g.font = '10px system-ui, sans-serif'
    g.fillText('+50', 3, 11)
    g.fillText('−50', 3, h - 3)
    g.fillText(`±${tol}¢`, w - 34, y(tol) - 3)
  }, [jejak, tol, sekarang])
  return (
    <canvas
      ref={ref}
      data-testid="grafik-jejak-nada"
      data-titik={jejak.filter((p) => p.sen !== null).length}
      className="block h-[120px] w-full rounded-lg border border-slate-800"
    />
  )
}

/** Panel kestabilan: pilihan jenjang, grafik, penghitung tahan, dan diagnosis. */
export function PanelKestabilanNada({
  jejak,
  toleransi,
  onToleransi,
  sekarang,
  nyala,
}: {
  jejak: TitikJejak[]
  toleransi: IdToleransi
  onToleransi: (id: IdToleransi) => void
  sekarang: number
  nyala: boolean
}) {
  const tol = (JENJANG_TOLERANSI.find((j) => j.id === toleransi) ?? JENJANG_TOLERANSI[1]).sen
  const a = useMemo(() => analisisJejak(jejak, tol), [jejak, tol])
  return (
    <div className="mt-3 space-y-2" data-testid="panel-kestabilan">
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Jenjang toleransi">
        {JENJANG_TOLERANSI.map((j) => (
          <button
            key={j.id}
            type="button"
            role="radio"
            aria-checked={toleransi === j.id}
            data-testid={`toleransi-${j.id}`}
            title={j.keterangan}
            onClick={() => onToleransi(j.id)}
            className={[
              'rounded-full border px-2.5 py-1 text-[11px] tabular-nums transition',
              toleransi === j.id
                ? 'border-emerald-600/40 bg-emerald-600/15 text-emerald-200'
                : 'border-slate-800 text-slate-400 hover:bg-slate-800/50',
            ].join(' ')}
          >
            {j.label} ±{j.sen}¢
          </button>
        ))}
      </div>
      <GrafikJejakNada jejak={jejak} tol={tol} sekarang={sekarang} />
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 py-1">
          <div className="text-[10px] text-slate-500">Tahan stabil</div>
          <div className="text-sm font-semibold tabular-nums text-emerald-300" data-testid="tahan-kini">
            {a.tahanKini.toLocaleString('id-ID', { minimumFractionDigits: 1 })} dtk
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 py-1">
          <div className="text-[10px] text-slate-500">Terbaik</div>
          <div className="text-sm font-semibold tabular-nums text-slate-100" data-testid="tahan-terbaik">
            {a.tahanTerbaik.toLocaleString('id-ID', { minimumFractionDigits: 1 })} dtk
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 py-1">
          <div className="text-[10px] text-slate-500">Dalam ±{tol}¢</div>
          <div className="text-sm font-semibold tabular-nums text-slate-100" data-testid="persen-dalam">
            {a.persenDalam}%
          </div>
        </div>
      </div>
      <ul className="min-h-[18px] space-y-0.5 text-[11px] leading-relaxed text-slate-300" data-testid="catatan-intonasi">
        {a.catatan.length
          ? a.catatan.map((c) => <li key={c}>• {c}</li>)
          : (
            <li className="text-slate-500">
              {nyala ? 'Tiup satu nada panjang (≥ 1 detik) untuk melihat diagnosis serangan, goyangan, & ekor nada.' : 'Grafik berjalan saat penala mendengarkan.'}
            </li>
          )}
      </ul>
    </div>
  )
}

/* ============================================================================
 * #29 — Peta kecenderungan nada per alat
 * ========================================================================== */

type Tahap = 'daftar' | 'atur' | 'rekam' | 'hasil'

/**
 * Alur ±2 menit: pilih tangga & wilayah → mainkan tiap nada sampai bilah
 * penuh (≥ 1,5 dtk stabil) → peta tersimpan di perangkat ini dan bisa
 * dicetak sebagai kartu saku A6/A5. Memakai penala yang sama (mikrofon
 * tidak dibuka dua kali).
 */
export function PetaKecenderunganNada({
  hasil,
  nyala,
  a4,
  transposisi,
  onButuhMikrofon,
  namaBawaan,
}: {
  hasil: HasilNada | null
  nyala: boolean
  a4: number
  transposisi: string
  onButuhMikrofon: () => Promise<void> | void
  namaBawaan?: string
}) {
  const toast = useToast()
  const [tahap, setTahap] = useState<Tahap>('daftar')
  const [daftar, setDaftar] = useState<PetaKecenderungan[]>(() => bacaDaftarPeta())
  const [nama, setNama] = useState(namaBawaan ?? '')
  const [tanggaId, setTanggaId] = useState(DAFTAR_TANGGA_PETA[0].id as string)
  const [wilayahId, setWilayahId] = useState(() => wilayahBawaan(transposisi))
  const [sasaran, setSasaran] = useState<number[]>([])
  const [ke, setKe] = useState(0)
  const [hasilNada, setHasilNada] = useState<NadaPeta[]>([])
  const [dilihat, setDilihat] = useState<PetaKecenderungan | null>(null)
  const sampelRef = useRef<SampelPeta[]>([])
  const [progres, setProgres] = useState(0)

  useEffect(() => {
    if (tahap === 'daftar') setWilayahId(wilayahBawaan(transposisi))
  }, [transposisi, tahap])

  const target = sasaran[ke]

  /** Kumpulkan cuplikan yang cocok dengan nada sasaran (konser). */
  useEffect(() => {
    if (tahap !== 'rekam' || target === undefined || !hasil) return
    const midi = Math.round(69 + 12 * Math.log2(hasil.target / a4))
    if (midi !== target) return
    const kini = performance.now()
    const akhir = sampelRef.current[sampelRef.current.length - 1]
    // Tiupan terputus > 0,4 dtk → mulai hitung ulang (yang dinilai satu tiupan utuh).
    if (akhir && kini - akhir.t > 400) sampelRef.current = []
    sampelRef.current.push({ t: kini, sen: hasil.sen })
    const r = ringkasSampelNada(sampelRef.current)
    const durasi = sampelRef.current[sampelRef.current.length - 1].t - sampelRef.current[0].t
    setProgres(Math.min(1, durasi / (SYARAT_SAMPEL.minimalMs - SYARAT_SAMPEL.buangAwalMs)))
    if (r?.cukup) simpanNada({ midi: target, sen: r.sen, n: r.n, sebaran: r.sebaran })
  }, [hasil])

  function simpanNada(n: NadaPeta | null) {
    const baru = n ? [...hasilNada, n] : hasilNada
    sampelRef.current = []
    setProgres(0)
    setHasilNada(baru)
    if (ke + 1 >= sasaran.length) selesai(baru)
    else setKe(ke + 1)
  }

  function selesai(nada: NadaPeta[]) {
    if (!nada.length) {
      toast.push('Belum ada nada yang terekam — peta tidak disimpan', 'err')
      setTahap('daftar')
      return
    }
    const p: PetaKecenderungan = {
      id: `peta-${Date.now().toString(36)}`,
      nama: nama.trim() || 'Tanpa nama',
      transposisi,
      a4,
      tangga: cariTanggaPeta(tanggaId).id,
      dibuat: Date.now(),
      nada,
    }
    setDaftar(simpanPeta(p))
    setDilihat(p)
    setTahap('hasil')
    toast.push(`Peta nada "${p.nama}" disimpan di perangkat ini`)
  }

  async function mulaiRekam() {
    const daftarNada = nadaSasaranPeta(tanggaId, cariWilayah(wilayahId).oktaf)
    setSasaran(daftarNada)
    setKe(0)
    setHasilNada([])
    sampelRef.current = []
    setProgres(0)
    setTahap('rekam')
    if (!nyala) await onButuhMikrofon()
  }

  async function cetak(p: PetaKecenderungan, ukuran: 'a6' | 'a5') {
    const { bangunHtmlKartuPeta } = await import('../../lib/petaNadaCetak')
    const html = bangunHtmlKartuPeta(p, ukuran)
    const berkas = `peta-nada-${p.nama.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pemain'}-${ukuran}.html`
    if (!printHtml(html)) {
      downloadHtmlFile(html, berkas)
      toast.push('Jendela cetak diblokir — berkas HTML diunduh, buka lalu Ctrl+P.', 'info')
    }
  }

  const sedangCocok =
    tahap === 'rekam' && hasil && target !== undefined && Math.round(69 + 12 * Math.log2(hasil.target / a4)) === target

  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4" data-testid="kartu-peta-nada">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-300">Peta kecenderungan nada</h3>
        <span className="text-[11px] text-slate-500">±2 menit · disimpan di perangkat ini</span>
      </div>

      {tahap === 'daftar' && (
        <div className="space-y-2">
          <p className="text-[11px] leading-relaxed text-slate-400">
            Tiap alat punya nada yang cenderung tinggi atau rendah. Mainkan tangga nada sekali, DrillKit mengukur
            selisih sen tiap nada lalu mencetaknya sebagai kartu saku untuk lyre.
          </p>
          {daftar.length > 0 && (
            <ul className="space-y-1.5" data-testid="daftar-peta-nada">
              {daftar.map((p) => {
                const r = ringkasPeta(p)
                return (
                  <li key={p.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-2.5 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-200">{p.nama}</p>
                      <p className="text-[10px] text-slate-500">
                        {p.nada.length} nada · rata-rata {r.rataAbs}¢
                        {r.tertinggi ? ` · tinggi ${labelNadaPeta(r.tertinggi.midi, p.transposisi).tertulis}` : ''}
                        {r.terendah ? ` · rendah ${labelNadaPeta(r.terendah.midi, p.transposisi).tertulis}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" data-testid={`lihat-peta-${p.id}`} onClick={() => { setDilihat(p); setTahap('hasil') }}>
                        Lihat
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDaftar(hapusPeta(p.id))}>
                        Hapus
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <Button size="sm" variant="primary" className="w-full" data-testid="buat-peta-nada" onClick={() => setTahap('atur')}>
            Buat peta nada baru
          </Button>
        </div>
      )}

      {tahap === 'atur' && (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-[11px] text-slate-500" htmlFor="nama-peta">
              Nama pemain / alat
            </label>
            <Input id="nama-peta" data-testid="nama-peta" data-kiosk-allow value={nama} placeholder="mis. Rani — Trumpet 2" onChange={(e) => setNama(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1 block text-[11px] text-slate-500" htmlFor="tangga-peta">Tangga nada</label>
              <Select id="tangga-peta" data-testid="tangga-peta" data-kiosk-allow value={tanggaId} onChange={(e) => setTanggaId(e.target.value)}>
                {DAFTAR_TANGGA_PETA.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </Select>
            </div>
            <div className="min-w-0">
              <label className="mb-1 block text-[11px] text-slate-500" htmlFor="wilayah-peta">Wilayah alat</label>
              <Select id="wilayah-peta" data-testid="wilayah-peta" data-kiosk-allow value={wilayahId} onChange={(e) => setWilayahId(e.target.value)}>
                {WILAYAH_PETA.map((w) => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">
            Nada tampil sesuai pilihan <b>Instrumen</b> di atas. Pakai acuan A4 {a4} Hz yang sama dengan band.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" className="flex-1" data-testid="mulai-peta-nada" onClick={() => void mulaiRekam()}>
              Mulai rekam
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setTahap('daftar')}>Batal</Button>
          </div>
        </div>
      )}

      {tahap === 'rekam' && target !== undefined && (
        <div className="space-y-2 text-center">
          <p className="text-[11px] text-slate-400" data-testid="langkah-peta">
            Nada {ke + 1} dari {sasaran.length}
          </p>
          <div className="text-3xl font-bold tabular-nums text-slate-100" data-testid="sasaran-peta">
            {labelNadaPeta(target, transposisi).tertulis}
          </div>
          {labelNadaPeta(target, transposisi).konser !== labelNadaPeta(target, transposisi).tertulis && (
            <p className="text-[11px] text-slate-500" data-testid="sasaran-konser-peta">konser {labelNadaPeta(target, transposisi).konser}</p>
          )}
          <p className="text-xs tabular-nums" style={{ color: sedangCocok ? warnaSen(hasil?.sen, 8) : '#64748b' }}>
            {sedangCocok ? `${hasil!.sen > 0 ? '+' : ''}${hasil!.sen} sen — tahan…` : 'Mainkan nada ini panjang & rileks'}
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.round(progres * 100)}%`, background: '#10b981' }} data-testid="progres-peta" />
          </div>
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="ghost" data-testid="lewati-nada-peta" onClick={() => simpanNada(null)}>Lewati nada</Button>
            <Button size="sm" variant="ghost" onClick={() => selesai(hasilNada)}>Selesai sekarang</Button>
          </div>
        </div>
      )}

      {tahap === 'hasil' && dilihat && (
        <div className="space-y-2" data-testid="hasil-peta-nada">
          <p className="text-xs font-medium text-slate-200">{dilihat.nama}</p>
          <div className="max-h-64 overflow-auto rounded-lg border border-slate-800">
            <table className="w-full text-[11px]">
              <tbody>
                {dilihat.nada.map((n) => {
                  const l = labelNadaPeta(n.midi, dilihat.transposisi)
                  const s = saranKecenderungan(n.sen)
                  const warna = s.arah === 'tinggi' ? '#f87171' : s.arah === 'rendah' ? '#60a5fa' : '#34d399'
                  return (
                    <tr key={n.midi} className="border-b border-slate-800/80 last:border-0" data-testid={`baris-peta-${n.midi}`}>
                      <td className="px-2 py-1 font-semibold text-slate-200">{l.tertulis}</td>
                      <td className="px-2 py-1 text-right font-semibold tabular-nums" style={{ color: warna }}>
                        {n.sen > 0 ? '+' : ''}{n.sen}¢
                      </td>
                      <td className="px-2 py-1 text-slate-400">{s.teks}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" data-testid="cetak-peta-a6" onClick={() => void cetak(dilihat, 'a6')}>Cetak kartu A6</Button>
            <Button size="sm" variant="ghost" data-testid="cetak-peta-a5" onClick={() => void cetak(dilihat, 'a5')}>Cetak A5</Button>
            <Button size="sm" variant="ghost" onClick={() => setTahap('daftar')}>Kembali</Button>
          </div>
        </div>
      )}
    </div>
  )
}
