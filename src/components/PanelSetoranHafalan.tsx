/**
 * #14 — Panel Matriks Setoran Hafalan (*Music & Visual Pass-Off Tracker*).
 *
 * Mencakup empat alur utama pelatih & section leader:
 * 1. Daftar Target Setoran (*Checkpoints*) manual maupun otomatis dari segmen lagu;
 * 2. Matriks `[Anggota × Target]` ketuk-cepat 6 jenjang + modal rincian (tanggal, penguji, catatan);
 * 3. Mode Uji Cepat *Section Leader* ramah jempol di HP + pemutar *loop* frasa lagu (`#11d` / `#13b`);
 * 4. Papan Kesiapan Tim per seksi/target & Pratinjau Cetak Matriks A4 murni `#hex` (+ Unduh HTML).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type {
  CatatanSetoran,
  JenjangSetoran,
  KategoriSetoran,
  Member,
  Song,
  TargetSetoran,
} from '../db/types'
import { useSettings } from '../hooks/useSettings'
import { NamaTampil } from './NamaTampil'
import { namaDenganPanggilan } from '../lib/namaAnggota'
import {
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  StatTile,
  Textarea,
  useToast,
} from './ui'
import { IconDownload, IconMusic, IconPause, IconPlay, IconPlus } from './Icons'
import {
  LABEL_JENJANG_SETORAN,
  LABEL_KATEGORI_SETORAN,
  SINGKATAN_JENJANG_SETORAN,
  URUTAN_JENJANG_SETORAN,
  WARNA_JENJANG_GELAP,
  apakahLulusSetoran,
  bangunHtmlCetakMatriksSetoran,
  batasLulusEfektif,
  buatSaranTargetDariLagu,
  hitungRingkasanSetoranTim,
  idCatatanSetoran,
  jenjangBerikutnya,
  targetBerlakuUntukAnggota,
  urutkanTargetSetoran,
} from '../lib/setoran'
import { simpanLoncatLatih } from '../lib/partiturFrasa'
import {
  PemutarNadaPartitur,
  jadwalkanDetikNada,
  uraiJadwalNadaMusicXml,
  type JadwalNadaPartitur,
} from '../lib/partiturBunyi'
import { cx, downloadFile, sectionLabel, todayISO, uid, visibleSections } from '../lib/utils'

const KUNCI_PENGUJI = 'drillkit_penguji_setoran_v1'

function bacaPengujiAwal(cadangan: string): string {
  try {
    const v = localStorage.getItem(KUNCI_PENGUJI)
    return v && v.trim() ? v.trim() : cadangan
  } catch {
    return cadangan
  }
}

function simpanPenguji(nama: string): void {
  try {
    localStorage.setItem(KUNCI_PENGUJI, nama)
  } catch {
    // abaikan jika localStorage diblokir
  }
}

/** Jadwal klik metronom sintetis ketika lagu belum memiliki berkas MusicXML. */
function buatJadwalKlikCadangan(song: Song, dariBirama: number, sampaiBirama: number): JadwalNadaPartitur {
  const maks = Math.max(sampaiBirama, song.panjangBirama ?? 0, 1)
  const ketukDasar = Math.max(1, song.tandaBirama?.pembilang ?? song.beats ?? 4)
  const penyebutDasar = Math.max(1, song.tandaBirama?.penyebut ?? 4)
  const birama = []
  const nada = []
  for (let b = 1; b <= maks; b += 1) {
    birama.push({
      birama: b,
      beats: ketukDasar,
      beatType: penyebutDasar,
      tempoPerempat: song.bpm || 120,
    })
    if (b >= dariBirama && b <= sampaiBirama) {
      const langkahPerempat = 4 / penyebutDasar
      for (let k = 0; k < ketukDasar; k += 1) {
        nada.push({
          idPart: 'KLIK',
          suara: '1',
          birama: b,
          mulaiPerempat: k * langkahPerempat,
          durasiPerempat: langkahPerempat * 0.5,
          jenis: 'perkusi' as const,
          warnaPerkusi: k === 0 ? ('tinggi' as const) : ('sedang' as const),
        })
      }
    }
  }
  return {
    jumlahBirama: maks,
    idPartTermuat: ['KLIK'],
    birama,
    nada,
  }
}

export function PanelSetoranHafalan() {
  const toast = useToast()
  const navigate = useNavigate()
  const settings = useSettings()

  const members = useLiveQuery(() => db.members.toArray(), [], [])
  const songs = useLiveQuery(() => db.songs.orderBy('title').toArray(), [], [])
  const targetsRaw = useLiveQuery(() => db.targetSetoran.toArray(), [], [])
  const catatan = useLiveQuery(() => db.setoran.toArray(), [], [])

  const targets = useMemo(() => urutkanTargetSetoran(targetsRaw ?? []), [targetsRaw])
  const petaLagu = useMemo(() => new Map((songs ?? []).map((s) => [s.id, s])), [songs])
  const sectionsTim = useMemo(
    () => visibleSections(),
    [settings?.sections],
  )
  const hariIni = todayISO()

  const ringkasan = useMemo(
    () => hitungRingkasanSetoranTim(targets, catatan ?? [], members ?? [], sectionsTim, hariIni),
    [targets, catatan, members, sectionsTim, hariIni],
  )

  const [tampilan, setTampilan] = useState<'matriks' | 'uji'>('matriks')
  const [saringSeksi, setSaringSeksi] = useState<string>('all')
  const [saringLagu, setSaringLagu] = useState<string>('all')
  const [penguji, setPenguji] = useState<string>(() =>
    bacaPengujiAwal(settings?.coachName || 'Pelatih'),
  )

  const [modalTarget, setModalTarget] = useState<{ mode: 'tambah' | 'ubah'; item?: TargetSetoran } | null>(null)
  const [laguOtomatisId, setLaguOtomatisId] = useState<string>('')
  const [modalRincian, setModalRincian] = useState<{ target: TargetSetoran; member: Member } | null>(null)
  const [modalCetak, setModalCetak] = useState(false)

  // State khusus Mode Uji Cepat Section Leader
  const [ujiTargetId, setUjiTargetId] = useState<string>('')
  const [persenTempoUji, setPersenTempoUji] = useState<number>(100)
  const [sedangBunyi, setSedangBunyi] = useState(false)
  const [posisiBunyi, setPosisiBunyi] = useState<{ birama: number; ketuk: number } | null>(null)
  const [sumberBunyiLabel, setSumberBunyiLabel] = useState<string>('')
  const pemutarRef = useRef<PemutarNadaPartitur | null>(null)
  const iframeCetakRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    if (!ujiTargetId && targets.length > 0) {
      setUjiTargetId(targets[0].id)
    } else if (ujiTargetId && targets.length > 0 && !targets.some((t) => t.id === ujiTargetId)) {
      setUjiTargetId(targets[0].id)
    }
  }, [targets, ujiTargetId])

  const idLaguOtomatisEfektif = useMemo(() => {
    const daftar = songs ?? []
    if (laguOtomatisId && daftar.some((s) => s.id === laguOtomatisId)) return laguOtomatisId
    return daftar[0]?.id ?? ''
  }, [songs, laguOtomatisId])

  // Hentikan pemutar WebAudio saat berganti target/mode atau komponen dilepas.
  useEffect(() => {
    pemutarRef.current?.henti()
    setSedangBunyi(false)
    setPosisiBunyi(null)
  }, [ujiTargetId, tampilan, persenTempoUji])

  useEffect(() => {
    return () => {
      pemutarRef.current?.henti()
    }
  }, [])

  const anggotaAktif = useMemo(
    () =>
      (members ?? [])
        .filter((m) => m.active !== 0)
        .filter((m) => saringSeksi === 'all' || m.section === saringSeksi)
        .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [members, saringSeksi],
  )

  const targetTampil = useMemo(
    () =>
      targets.filter((t) => {
        if (saringLagu === 'all') return true
        if (saringLagu === '__tanpa_lagu') return !t.songId
        return t.songId === saringLagu
      }),
    [targets, saringLagu],
  )

  const targetUjiAktif = useMemo(
    () => targets.find((t) => t.id === ujiTargetId) ?? targets[0] ?? null,
    [targets, ujiTargetId],
  )

  async function simpanSelSetoran(
    target: TargetSetoran,
    memberId: string,
    jenjangBaru: JenjangSetoran,
    ekstra?: { tanggal?: string; penguji?: string; catatan?: string },
  ) {
    const id = idCatatanSetoran(target.id, memberId)
    const lama = await db.setoran.get(id)
    if (jenjangBaru === 'belum' && !ekstra?.catatan?.trim() && lama) {
      await db.setoran.delete(id)
      return
    }
    const baris: CatatanSetoran = {
      id,
      targetId: target.id,
      memberId,
      jenjang: jenjangBaru,
      tanggal: ekstra?.tanggal || hariIni,
      diubahAt: Date.now(),
      penguji: (ekstra?.penguji ?? penguji).trim() || undefined,
      catatan: (ekstra?.catatan ?? lama?.catatan ?? '').trim() || undefined,
    }
    await db.setoran.put(baris)
  }

  async function ketukCepatSel(target: TargetSetoran, member: Member) {
    if (!targetBerlakuUntukAnggota(target, member)) return
    const id = idCatatanSetoran(target.id, member.id)
    const lama = await db.setoran.get(id)
    const sekarang = lama?.jenjang ?? 'belum'
    const berikut = jenjangBerikutnya(sekarang, batasLulusEfektif(target))
    await simpanSelSetoran(target, member.id, berikut)
  }

  async function buatOtomatisDariLagu() {
    const song = (songs ?? []).find((s) => s.id === idLaguOtomatisEfektif)
    if (!song) {
      toast.push('Pilih lagu terlebih dahulu', 'err')
      return
    }
    const draf = buatSaranTargetDariLagu(song)
    const judulAda = new Set(targets.map((t) => t.judul.trim().toLowerCase()))
    const baru: TargetSetoran[] = []
    let urutan = targets.length > 0 ? Math.max(...targets.map((t) => t.urutan)) + 1 : 1
    const kini = Date.now()
    for (const d of draf) {
      if (judulAda.has(d.judul.trim().toLowerCase())) continue
      baru.push({
        id: uid('ts_'),
        judul: d.judul,
        kategori: d.kategori,
        songId: d.songId,
        biramaDari: d.biramaDari,
        biramaSampai: d.biramaSampai,
        batasLulus: 'lulus_gerak',
        urutan: urutan++,
        createdAt: kini,
      })
    }
    if (baru.length === 0) {
      toast.push('Semua bagian lagu ini sudah ada di daftar target', 'info')
      return
    }
    await db.targetSetoran.bulkPut(baru)
    toast.push(`${baru.length} target setoran dibuat dari "${song.title}"`)
  }

  async function hapusTarget(target: TargetSetoran) {
    await db.transaction('rw', [db.targetSetoran, db.setoran], async () => {
      await db.targetSetoran.delete(target.id)
      await db.setoran.where('targetId').equals(target.id).delete()
    })
    toast.push(`Target "${target.judul}" dihapus`, 'info')
  }

  function loncatKeMusik(target: TargetSetoran) {
    if (!target.songId) return
    simpanLoncatLatih({
      songId: target.songId,
      dari: target.biramaDari,
      sampai: target.biramaSampai,
      label: target.judul,
    })
    navigate('/musik')
  }

  async function togglePutarFrasaUji() {
    if (sedangBunyi) {
      pemutarRef.current?.henti()
      setSedangBunyi(false)
      setPosisiBunyi(null)
      return
    }
    if (!targetUjiAktif?.songId) return
    const song = petaLagu.get(targetUjiAktif.songId)
    if (!song) {
      toast.push('Lagu rujukan tidak ditemukan di repertoar', 'err')
      return
    }
    const dari = Math.max(1, targetUjiAktif.biramaDari ?? 1)
    const sampai = Math.max(
      dari,
      targetUjiAktif.biramaSampai ?? song.panjangBirama ?? song.partitur?.jumlahBirama ?? dari + 7,
    )

    let jadwalNada: JadwalNadaPartitur | null = null
    let labelSumber = 'Klik Metronom Frasa'
    try {
      const berkas = await db.partiturBerkas.get(song.id)
      if (berkas && berkas.tipe === 'musicxml') {
        const xml = await berkas.blob.text()
        const urai = uraiJadwalNadaMusicXml(xml)
        if (urai.nada.length > 0) {
          jadwalNada = urai
          labelSumber = 'Nada Panduan Partitur'
        }
      }
    } catch {
      // jatuh ke klik metronom cadangan
    }
    if (!jadwalNada) {
      jadwalNada = buatJadwalKlikCadangan(song, dari, sampai)
    }

    const hasilJadwal = jadwalkanDetikNada(jadwalNada, {
      tempoMap: song.tempoMap,
      tempoDasar: song.bpm || 120,
      persenTempo: persenTempoUji,
      dariBirama: dari,
      sampaiBirama: sampai,
    })
    if (!pemutarRef.current) pemutarRef.current = new PemutarNadaPartitur()
    const ok = await pemutarRef.current.mulai({
      hasilJadwal,
      ulang: true,
      volume: 0.5,
      onPosisi: (birama, ketuk) => setPosisiBunyi({ birama, ketuk }),
      onSelesai: () => {
        setSedangBunyi(false)
        setPosisiBunyi(null)
      },
    })
    if (!ok) {
      toast.push('Audio peramban tidak dapat dimulai', 'err')
      return
    }
    setSumberBunyiLabel(labelSumber)
    setSedangBunyi(true)
  }

  const htmlCetak = useMemo(() => {
    if (!modalCetak) return ''
    const subjudul =
      saringSeksi === 'all' ? 'Semua Seksi' : `Seksi ${sectionLabel(saringSeksi)}`
    return bangunHtmlCetakMatriksSetoran({
      namaTim: settings?.teamName || 'Tim',
      subjudulSeksi: subjudul,
      tanggalCetak: hariIni,
      targets: targetTampil,
      members: anggotaAktif,
      catatan: catatan ?? [],
      sectionsTim,
    })
  }, [modalCetak, saringSeksi, settings?.teamName, hariIni, targetTampil, anggotaAktif, catatan, sectionsTim])

  return (
    <div data-testid="panel-setoran-hafalan" className="space-y-4">
      {/* ---------------- Ringkasan Kesiapan Tim ---------------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Kesiapan hafalan tim"
          value={ringkasan.totalWajib > 0 ? `${ringkasan.persenSiap}%` : '—'}
          sub={
            ringkasan.jumlahTarget > 0
              ? `${ringkasan.jumlahTarget} target · ${ringkasan.jumlahAnggotaAktif} anggota aktif`
              : 'belum ada target setoran'
          }
          accent={
            ringkasan.totalWajib === 0
              ? undefined
              : ringkasan.persenSiap >= 80
                ? 'text-emerald-400'
                : ringkasan.persenSiap >= 50
                  ? 'text-amber-300'
                  : 'text-rose-400'
          }
        />
        <StatTile
          label="Lulus penuh"
          value={
            ringkasan.totalWajib > 0
              ? `${ringkasan.totalLulus}/${ringkasan.totalWajib}`
              : '0'
          }
          sub={
            ringkasan.totalWajib > 0
              ? `${ringkasan.persenLulus}% sel wajib tuntas`
              : 'tambah target untuk mulai melacak'
          }
        />
        <StatTile
          label="Lewat tenggat"
          value={String(ringkasan.totalTerlambat)}
          sub="tanggungan belum lulus melewati batas tanggal"
          accent={ringkasan.totalTerlambat > 0 ? 'text-rose-400' : undefined}
        />
      </div>

      {/* ---------------- Grafik Kesiapan per Seksi & Target ---------------- */}
      {targets.length > 0 && anggotaAktif.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card data-testid="grafik-kesiapan-seksi">
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Kesiapan per Seksi
            </h3>
            <div className="space-y-2">
              {ringkasan.perSeksi.map((s) => (
                <div key={s.sectionId}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{s.label}</span>
                    <span className="tabular-nums text-slate-400">
                      {s.lulus}/{s.wajib} lulus · <b className="text-slate-100">{s.persenSiap}%</b>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: '#1e293b' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${s.persenSiap}%`,
                        background:
                          s.persenSiap >= 80 ? '#10b981' : s.persenSiap >= 50 ? '#f59e0b' : '#3b82f6',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card data-testid="grafik-kesiapan-target">
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Kesiapan per Target / Lagu
            </h3>
            <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
              {ringkasan.perTarget.map((pt) => (
                <div key={pt.target.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-slate-200">
                      {pt.target.judul}
                      {pt.terlambat && (
                        <span className="ml-1.5 rounded bg-rose-950/60 px-1.5 py-0.5 text-[10px] text-rose-300">
                          Lewat tenggat
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-400">
                      {pt.lulus}/{pt.wajib} · <b className="text-slate-100">{pt.persenSiap}%</b>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: '#1e293b' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pt.persenSiap}%`,
                        background: pt.persenSiap >= 80 ? '#10b981' : '#0ea5e9',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ---------------- Bilah Kendali & Aksi Target ---------------- */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={tampilan === 'matriks' ? 'primary' : 'ghost'}
              data-testid="mode-tampilan-matriks"
              onClick={() => setTampilan('matriks')}
            >
              Matriks Lengkap
            </Button>
            <Button
              size="sm"
              variant={tampilan === 'uji' ? 'primary' : 'ghost'}
              data-testid="mode-uji-cepat"
              onClick={() => setTampilan('uji')}
            >
              Uji Cepat Section Leader
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              data-testid="tombol-cetak-setoran"
              disabled={targets.length === 0 || anggotaAktif.length === 0}
              onClick={() => setModalCetak(true)}
            >
              <IconDownload size={14} /> Cetak / Unduh A4
            </Button>
            <Button
              size="sm"
              variant="primary"
              data-testid="tambah-target-setoran"
              onClick={() => setModalTarget({ mode: 'tambah' })}
            >
              <IconPlus size={14} /> Tambah Target
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Saring seksi">
            <Select
              data-testid="saring-seksi-setoran"
              value={saringSeksi}
              onChange={(e) => setSaringSeksi(e.target.value)}
            >
              <option value="all">Semua seksi</option>
              {sectionsTim.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Saring lagu">
            <Select
              data-testid="saring-lagu-setoran"
              value={saringLagu}
              onChange={(e) => setSaringLagu(e.target.value)}
            >
              <option value="all">Semua target</option>
              {(songs ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
              <option value="__tanpa_lagu">Tanpa tautan lagu</option>
            </Select>
          </Field>

          <Field label="Nama penguji saat ini">
            <Input
              data-testid="input-penguji-setoran"
              value={penguji}
              onChange={(e) => {
                setPenguji(e.target.value)
                simpanPenguji(e.target.value)
              }}
              placeholder="Mis. Pelatih / Ketua Brass"
            />
          </Field>

          {(songs ?? []).length > 0 && (
            <div className="flex flex-col justify-end gap-1">
              <span className="text-xs font-medium text-slate-400">Generator cepat dari lagu</span>
              <div className="flex gap-1.5">
                <Select
                  aria-label="Pilih lagu generator target"
                  data-testid="pilih-lagu-otomatis"
                  value={idLaguOtomatisEfektif}
                  onChange={(e) => setLaguOtomatisId(e.target.value)}
                  className="min-w-0 flex-1"
                >
                  {(songs ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  data-testid="otomatis-target-lagu"
                  onClick={() => void buatOtomatisDariLagu()}
                  title="Buat target otomatis dari segmen tempo lagu"
                >
                  + Segmen
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ---------------- Isi Utama: Kosong / Matriks / Uji Cepat ---------------- */}
      {targets.length === 0 ? (
        <EmptyState
          icon={<IconMusic size={28} />}
          title="Belum ada target setoran hafalan"
          desc="Tambahkan target setoran (mis. Lagu 1: Birama 1–16, Cadence Battery, atau Warm-up Brass), atau buat otomatis dari segmen lagu yang sudah ada."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="primary"
                onClick={() => setModalTarget({ mode: 'tambah' })}
              >
                <IconPlus size={16} /> Tambah target pertama
              </Button>
              {(songs ?? []).length > 0 && (
                <Button onClick={() => void buatOtomatisDariLagu()}>
                  Buat dari lagu &ldquo;{songs![0].title}&rdquo;
                </Button>
              )}
            </div>
          }
        />
      ) : anggotaAktif.length === 0 ? (
        <EmptyState
          title="Tidak ada anggota aktif pada saringan ini"
          desc="Pilih seksi lain atau tambahkan anggota aktif di menu Anggota."
        />
      ) : tampilan === 'matriks' ? (
        <Card padded={false}>
          <div className="border-b border-slate-800 px-4 py-2.5 text-[11px] text-slate-400">
            Ketuk sel status untuk menaikkan jenjang (<b className="text-slate-200">Belum → Baca Lancar → Tempo Latihan → Tempo Asli → Hafal Musik → Lulus Sambil Gerak</b>). Tekan <b>✎</b> di pojok sel untuk mengisi catatan atau tanggal uji.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="tabel-matriks-setoran">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-left text-[11px] text-slate-400">
                  <th className="sticky left-0 z-10 bg-slate-950 px-3 py-2.5 font-semibold text-slate-200">
                    Anggota
                  </th>
                  <th className="px-2.5 py-2.5 font-semibold">Seksi</th>
                  {targetTampil.map((t) => {
                    const lagu = t.songId ? petaLagu.get(t.songId) : undefined
                    return (
                      <th key={t.id} className="min-w-[9.5rem] px-2.5 py-2.5 align-top">
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-semibold text-slate-200">{t.judul}</span>
                          <button
                            type="button"
                            data-testid={`ubah-target-${t.id}`}
                            onClick={() => setModalTarget({ mode: 'ubah', item: t })}
                            className="shrink-0 rounded px-1 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                            title="Ubah / hapus target"
                          >
                            ✎
                          </button>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] font-normal text-slate-500">
                          <span>{LABEL_KATEGORI_SETORAN[t.kategori]}</span>
                          {t.biramaDari != null && t.biramaSampai != null && (
                            <span>· Bar {t.biramaDari}–{t.biramaSampai}</span>
                          )}
                          {t.tenggat && <span>· Tenggat {t.tenggat}</span>}
                        </div>
                        {lagu && (
                          <button
                            type="button"
                            data-testid={`matriks-latih-musik-${t.id}`}
                            onClick={() => loncatKeMusik(t)}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 hover:text-emerald-300"
                          >
                            <IconMusic size={11} /> Buka frasa
                          </button>
                        )}
                      </th>
                    )
                  })}
                  <th className="px-3 py-2.5 text-right font-semibold">Capaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {anggotaAktif.map((m) => {
                  const ra = ringkasan.perAnggota[m.id]
                  return (
                    <tr key={m.id} data-testid={`baris-setoran-${m.id}`}>
                      <td className="sticky left-0 z-10 bg-slate-900 px-3 py-2 font-medium text-slate-100">
                        <div className="truncate max-w-[11rem]">
                          <NamaTampil anggota={m} />
                        </div>
                        <div className="text-[10px] text-slate-500">{m.code}</div>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-2 text-slate-400">
                        {sectionLabel(m.section)}
                      </td>
                      {targetTampil.map((t) => {
                        const wajib = targetBerlakuUntukAnggota(t, m)
                        if (!wajib) {
                          return (
                            <td key={t.id} className="px-2.5 py-2 text-center text-slate-600">
                              —
                            </td>
                          )
                        }
                        const idSel = idCatatanSetoran(t.id, m.id)
                        const isi = ringkasan.petaSel.get(idSel)
                        const jenjang = isi?.jenjang ?? 'belum'
                        const warna = WARNA_JENJANG_GELAP[jenjang]
                        const lulus = apakahLulusSetoran(jenjang, batasLulusEfektif(t))
                        return (
                          <td key={t.id} className="px-2.5 py-2">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                data-testid={`sel-setoran-${t.id}-${m.id}`}
                                onClick={() => void ketukCepatSel(t, m)}
                                style={{
                                  backgroundColor: warna.bg,
                                  borderColor: warna.border,
                                  color: warna.text,
                                }}
                                className="flex-1 rounded-md border px-2 py-1.5 text-left text-[11px] font-semibold transition hover:brightness-110"
                                title={`${LABEL_JENJANG_SETORAN[jenjang]}${isi?.penguji ? ` · oleh ${isi.penguji}` : ''}${isi?.catatan ? ` — ${isi.catatan}` : ''}`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span>{SINGKATAN_JENJANG_SETORAN[jenjang]}</span>
                                  {lulus && <span aria-hidden="true">✓</span>}
                                </div>
                                {isi?.catatan && (
                                  <p className="mt-0.5 truncate text-[9px] font-normal opacity-80">
                                    {isi.catatan}
                                  </p>
                                )}
                              </button>
                              <button
                                type="button"
                                data-testid={`rincian-setoran-${t.id}-${m.id}`}
                                onClick={() => setModalRincian({ target: t, member: m })}
                                className="rounded border border-slate-800 px-1.5 py-1.5 text-[11px] text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                                aria-label={`Rincian setoran ${m.name} pada ${t.judul}`}
                              >
                                ✎
                              </button>
                            </div>
                          </td>
                        )
                      })}
                      <td
                        data-testid={`capaian-anggota-${m.id}`}
                        className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-300"
                      >
                        {ra && ra.wajib > 0 ? (
                          <>
                            <span className="font-semibold text-slate-100">{ra.persenSiap}%</span>
                            <span className="ml-1 text-[10px] text-slate-500">
                              ({ra.lulus}/{ra.wajib})
                            </span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* ---------------- Mode Uji Cepat Section Leader ---------------- */
        <div data-testid="panel-uji-cepat" className="space-y-3">
          <Card>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Target yang sedang diuji">
                <Select
                  data-testid="uji-pilih-target"
                  value={targetUjiAktif?.id ?? ''}
                  onChange={(e) => setUjiTargetId(e.target.value)}
                >
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.judul}
                      {t.biramaDari != null && t.biramaSampai != null
                        ? ` (Bar ${t.biramaDari}–${t.biramaSampai})`
                        : ''}
                    </option>
                  ))}
                </Select>
              </Field>

              {targetUjiAktif?.songId && petaLagu.has(targetUjiAktif.songId) ? (
                <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-200">
                        Loop Frasa: {petaLagu.get(targetUjiAktif.songId)?.title}
                        {targetUjiAktif.biramaDari != null && targetUjiAktif.biramaSampai != null
                          ? ` · Bar ${targetUjiAktif.biramaDari}–${targetUjiAktif.biramaSampai}`
                          : ''}
                      </p>
                      <p className="text-[11px] text-slate-400" data-testid="uji-status-bunyi">
                        {sedangBunyi && posisiBunyi
                          ? `${sumberBunyiLabel} · Birama ${posisiBunyi.birama} · Ketuk ${posisiBunyi.ketuk + 1} (${persenTempoUji}%)`
                          : 'Putar nada/klik frasa berulang sambil menguji pemain di depanmu'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Select
                        aria-label="Kecepatan tempo uji"
                        data-testid="uji-persen-tempo"
                        value={String(persenTempoUji)}
                        onChange={(e) => setPersenTempoUji(Number(e.target.value))}
                        className="w-24 text-xs"
                      >
                        <option value="75">Tempo 75%</option>
                        <option value="85">Tempo 85%</option>
                        <option value="100">Tempo 100%</option>
                      </Select>
                      <Button
                        size="sm"
                        variant={sedangBunyi ? 'danger' : 'primary'}
                        data-testid="uji-putar-frasa"
                        onClick={() => void togglePutarFrasaUji()}
                      >
                        {sedangBunyi ? (
                          <>
                            <IconPause size={14} /> Hentikan
                          </>
                        ) : (
                          <>
                            <IconPlay size={14} /> Putar Loop
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid="uji-buka-musik"
                        onClick={() => loncatKeMusik(targetUjiAktif)}
                      >
                        Buka Musik
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
                  Target ini tidak menautkan lagu repertoar — ketuk jenjang pemain langsung di bawah.
                </div>
              )}
            </div>
          </Card>

          {targetUjiAktif && (
            <div className="space-y-2">
              {anggotaAktif
                .filter((m) => targetBerlakuUntukAnggota(targetUjiAktif, m))
                .map((m) => {
                  const idSel = idCatatanSetoran(targetUjiAktif.id, m.id)
                  const sel = ringkasan.petaSel.get(idSel)
                  const jenjangKini = sel?.jenjang ?? 'belum'
                  return (
                    <Card
                      key={m.id}
                      data-testid={`uji-kartu-${m.id}`}
                      className="p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-100">
                            <NamaTampil anggota={m} />{' '}
                            <span className="text-xs font-normal text-slate-500">({m.code})</span>
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {sectionLabel(m.section)}
                            {m.instrument ? ` · ${m.instrument}` : ''}
                            {sel?.tanggal ? ` · Diuji ${sel.tanggal}` : ''}
                            {sel?.penguji ? ` oleh ${sel.penguji}` : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`uji-rincian-${m.id}`}
                          onClick={() => setModalRincian({ target: targetUjiAktif, member: m })}
                        >
                          Catatan ✎
                        </Button>
                      </div>

                      <div className="mt-2.5 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                        {URUTAN_JENJANG_SETORAN.map((j) => {
                          const aktifPil = jenjangKini === j
                          const w = WARNA_JENJANG_GELAP[j]
                          return (
                            <button
                              key={j}
                              type="button"
                              data-testid={`uji-pil-${m.id}-${j}`}
                              onClick={() => void simpanSelSetoran(targetUjiAktif, m.id, j)}
                              style={
                                aktifPil
                                  ? {
                                      backgroundColor: w.bg,
                                      borderColor: w.border,
                                      color: w.text,
                                    }
                                  : undefined
                              }
                              className={cx(
                                'rounded-md border px-2 py-1.5 text-center text-[11px] font-medium transition',
                                aktifPil
                                  ? 'ring-1 ring-emerald-400/50 font-semibold'
                                  : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
                              )}
                            >
                              {SINGKATAN_JENJANG_SETORAN[j]}
                            </button>
                          )
                        })}
                      </div>
                      {sel?.catatan && (
                        <p className="mt-2 rounded bg-slate-950/50 px-2.5 py-1.5 text-[11px] text-slate-300">
                          Catatan: {sel.catatan}
                        </p>
                      )}
                    </Card>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* ---------------- Modal Tambah / Ubah Target Setoran ---------------- */}
      {modalTarget && (
        <ModalTargetSetoran
          mode={modalTarget.mode}
          awal={modalTarget.item}
          urutanBerikut={
            targets.length > 0 ? Math.max(...targets.map((t) => t.urutan)) + 1 : 1
          }
          songs={songs ?? []}
          sectionsTim={sectionsTim}
          onClose={() => setModalTarget(null)}
          onHapus={modalTarget.item ? () => hapusTarget(modalTarget.item!) : undefined}
        />
      )}

      {/* ---------------- Modal Rincian Sel [Anggota × Target] ---------------- */}
      {modalRincian && (
        <ModalRincianSetoran
          target={modalRincian.target}
          member={modalRincian.member}
          awal={ringkasan.petaSel.get(
            idCatatanSetoran(modalRincian.target.id, modalRincian.member.id),
          )}
          pengujiDefault={penguji}
          onSimpan={async (jenjang, tanggal, olehPenguji, teksCatatan) => {
            await simpanSelSetoran(modalRincian.target, modalRincian.member.id, jenjang, {
              tanggal,
              penguji: olehPenguji,
              catatan: teksCatatan,
            })
            toast.push('Status setoran disimpan')
            setModalRincian(null)
          }}
          onClose={() => setModalRincian(null)}
        />
      )}

      {/* ---------------- Modal Pratinjau Cetak A4 Hex & Unduh HTML ---------------- */}
      <Modal
        open={modalCetak}
        onClose={() => setModalCetak(false)}
        title="Pratinjau Cetak Matriks Setoran A4"
        wide
        testId="modal-cetak-setoran"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalCetak(false)}>
              Tutup
            </Button>
            <Button
              data-testid="unduh-html-setoran"
              onClick={() => {
                downloadFile(
                  `Matriks-Setoran-${(settings?.teamName || 'Tim').replace(/\s+/g, '-')}-${hariIni}.html`,
                  htmlCetak,
                  'text/html',
                )
                toast.push('Dokumen HTML matriks setoran diunduh')
              }}
            >
              <IconDownload size={14} /> Unduh HTML
            </Button>
            <Button
              variant="primary"
              data-testid="cetak-a4-setoran"
              onClick={() => {
                const win = iframeCetakRef.current?.contentWindow
                if (win) {
                  win.focus()
                  win.print()
                }
              }}
            >
              Cetak A4
            </Button>
          </>
        }
      >
        <p className="mb-2 text-xs text-slate-400">
          Siap ditempel di papan pengumuman ruang latihan (A4 mendatar, murni warna hex tajam). Bila printer tidak terhubung di perangkat ini, klik <b>Unduh HTML</b>.
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-white">
          <iframe
            ref={iframeCetakRef}
            data-testid="iframe-cetak-setoran"
            title="Pratinjau Cetak Matriks Setoran"
            srcDoc={htmlCetak}
            className="h-[60vh] w-full bg-white"
          />
        </div>
      </Modal>
    </div>
  )
}

/* ========================================================================== */
/*  Modal Tambah / Sunting Target Setoran                                     */
/* ========================================================================== */

function ModalTargetSetoran({
  mode,
  awal,
  urutanBerikut,
  songs,
  sectionsTim,
  onClose,
  onHapus,
}: {
  mode: 'tambah' | 'ubah'
  awal?: TargetSetoran
  urutanBerikut: number
  songs: Song[]
  sectionsTim: { id: string; label: string }[]
  onClose: () => void
  onHapus?: () => Promise<void>
}) {
  const toast = useToast()
  const [judul, setJudul] = useState(awal?.judul ?? '')
  const [kategori, setKategori] = useState<KategoriSetoran>(awal?.kategori ?? 'gabungan')
  const [songId, setSongId] = useState(awal?.songId ?? '')
  const [biramaDari, setBiramaDari] = useState(
    awal?.biramaDari != null ? String(awal.biramaDari) : '',
  )
  const [biramaSampai, setBiramaSampai] = useState(
    awal?.biramaSampai != null ? String(awal.biramaSampai) : '',
  )
  const [batasLulus, setBatasLulus] = useState<Exclude<JenjangSetoran, 'belum'>>(
    awal?.batasLulus ?? 'lulus_gerak',
  )
  const [tenggat, setTenggat] = useState(awal?.tenggat ?? '')
  const [urutan, setUrutan] = useState(String(awal?.urutan ?? urutanBerikut))
  const [pilihSeksi, setPilihSeksi] = useState<Set<string>>(new Set(awal?.sections ?? []))
  const [catatan, setCatatan] = useState(awal?.catatan ?? '')

  function toggleSeksi(id: string) {
    const baru = new Set(pilihSeksi)
    if (baru.has(id)) baru.delete(id)
    else baru.add(id)
    setPilihSeksi(baru)
  }

  async function simpan() {
    const j = judul.trim()
    if (!j) {
      toast.push('Judul target wajib diisi', 'err')
      return
    }
    const bDari = biramaDari.trim() ? Math.max(1, Math.floor(Number(biramaDari))) : undefined
    const bSampai = biramaSampai.trim()
      ? Math.max(bDari ?? 1, Math.floor(Number(biramaSampai)))
      : undefined

    const entri: TargetSetoran = {
      id: awal?.id ?? uid('ts_'),
      judul: j,
      kategori,
      songId: songId || undefined,
      biramaDari: Number.isFinite(bDari) ? bDari : undefined,
      biramaSampai: Number.isFinite(bSampai) ? bSampai : undefined,
      sections: pilihSeksi.size > 0 ? [...pilihSeksi] : undefined,
      batasLulus,
      tenggat: tenggat.trim() || undefined,
      urutan: Math.max(1, Math.floor(Number(urutan) || urutanBerikut)),
      catatan: catatan.trim() || undefined,
      createdAt: awal?.createdAt ?? Date.now(),
    }
    await db.targetSetoran.put(entri)
    toast.push(mode === 'tambah' ? 'Target setoran ditambahkan' : 'Target setoran diperbarui')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'tambah' ? 'Tambah Target Setoran' : 'Ubah Target Setoran'}
      testId="modal-target-setoran"
      footer={
        <>
          {mode === 'ubah' && onHapus && (
            <ConfirmButton
              message="Hapus target ini beserta seluruh catatan kelulusannya?"
              onConfirm={async () => {
                await onHapus()
                onClose()
              }}
            />
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" data-testid="simpan-target-setoran" onClick={() => void simpan()}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Judul target">
          <Input
            data-testid="input-judul-target"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            placeholder="Mis. Lagu 1: Birama 1–16 / Cadence Battery"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kategori">
            <Select
              data-testid="pilih-kategori-target"
              value={kategori}
              onChange={(e) => setKategori(e.target.value as KategoriSetoran)}
            >
              <option value="gabungan">Musik + Gerak</option>
              <option value="musik">Musik Saja</option>
              <option value="visual">Visual / Gerak Saja</option>
            </Select>
          </Field>

          <Field label="Batas jenjang kelulusan (100%)">
            <Select
              data-testid="pilih-batas-lulus"
              value={batasLulus}
              onChange={(e) =>
                setBatasLulus(e.target.value as Exclude<JenjangSetoran, 'belum'>)
              }
            >
              {URUTAN_JENJANG_SETORAN.filter((j) => j !== 'belum').map((j) => (
                <option key={j} value={j}>
                  {LABEL_JENJANG_SETORAN[j]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Tautkan ke lagu repertoar (opsional)">
          <Select
            data-testid="pilih-lagu-target"
            value={songId}
            onChange={(e) => setSongId(e.target.value)}
          >
            <option value="">— Tanpa tautan lagu (latihan mandiri / warm-up) —</option>
            {songs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.bpm} BPM)
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Birama dari">
            <Input
              data-testid="input-birama-dari"
              type="number"
              min={1}
              value={biramaDari}
              onChange={(e) => setBiramaDari(e.target.value)}
              placeholder="1"
            />
          </Field>
          <Field label="Birama sampai">
            <Input
              data-testid="input-birama-sampai"
              type="number"
              min={1}
              value={biramaSampai}
              onChange={(e) => setBiramaSampai(e.target.value)}
              placeholder="16"
            />
          </Field>
          <Field label="Tenggat (opsional)">
            <Input
              data-testid="input-tenggat-target"
              type="date"
              value={tenggat}
              onChange={(e) => setTenggat(e.target.value)}
            />
          </Field>
          <Field label="Urutan kolom">
            <Input
              data-testid="input-urutan-target"
              type="number"
              min={1}
              value={urutan}
              onChange={(e) => setUrutan(e.target.value)}
            />
          </Field>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-400">
            Berlaku untuk seksi (kosongkan = wajib bagi seluruh seksi)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sectionsTim.map((s) => {
              const aktif = pilihSeksi.has(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`target-seksi-${s.id}`}
                  onClick={() => toggleSeksi(s.id)}
                  className={cx(
                    'rounded-md border px-2.5 py-1 text-xs transition',
                    aktif
                      ? 'border-emerald-500 bg-emerald-950/50 font-semibold text-emerald-200'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:text-slate-200',
                  )}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        <Field label="Catatan kriteria kelulusan (opsional)">
          <Textarea
            data-testid="input-catatan-target"
            rows={2}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Mis. artikulasi tegas, mark time stabil tanpa melihat partitur"
          />
        </Field>
      </div>
    </Modal>
  )
}

/* ========================================================================== */
/*  Modal Rincian Capaian Satu Sel [Anggota × Target]                         */
/* ========================================================================== */

function ModalRincianSetoran({
  target,
  member,
  awal,
  pengujiDefault,
  onSimpan,
  onClose,
}: {
  target: TargetSetoran
  member: Member
  awal?: CatatanSetoran
  pengujiDefault: string
  onSimpan: (
    jenjang: JenjangSetoran,
    tanggal: string,
    penguji: string,
    catatan: string,
  ) => Promise<void>
  onClose: () => void
}) {
  const [jenjang, setJenjang] = useState<JenjangSetoran>(awal?.jenjang ?? 'belum')
  const [tanggal, setTanggal] = useState(awal?.tanggal ?? todayISO())
  const [penguji, setPenguji] = useState(awal?.penguji ?? pengujiDefault)
  const [catatan, setCatatan] = useState(awal?.catatan ?? '')

  return (
    <Modal
      open
      onClose={onClose}
      title={`${namaDenganPanggilan(member)} — ${target.judul}`}
      testId="modal-rincian-setoran"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="primary"
            data-testid="simpan-rincian-setoran"
            onClick={() => void onSimpan(jenjang, tanggal, penguji, catatan)}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Jenjang capaian">
          <Select
            data-testid="pilih-jenjang-rincian"
            value={jenjang}
            onChange={(e) => setJenjang(e.target.value as JenjangSetoran)}
          >
            {URUTAN_JENJANG_SETORAN.map((j) => (
              <option key={j} value={j}>
                {LABEL_JENJANG_SETORAN[j]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tanggal uji">
            <Input
              data-testid="input-tanggal-rincian"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
            />
          </Field>
          <Field label="Penguji">
            <Input
              data-testid="input-penguji-rincian"
              value={penguji}
              onChange={(e) => setPenguji(e.target.value)}
              placeholder="Pelatih / Ketua Seksi"
            />
          </Field>
        </div>

        <Field label="Catatan umpan balik untuk anggota (ikut terkirim di paket pribadi)">
          <Textarea
            data-testid="input-catatan-rincian"
            rows={3}
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Mis. birama 13–16 perhatikan aksen ketuk ke-3"
          />
        </Field>
      </div>
    </Modal>
  )
}
