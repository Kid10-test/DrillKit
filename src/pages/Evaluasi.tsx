/**
 * H2 — Evaluasi & kemajuan anggota.
 *
 * Keluhan yang mendasarinya: *catatan evaluasi sekarang hanya teks bebas,
 * perkembangannya sulit dilihat.* Catatan bebas (yang tetap ada di halaman
 * Anggota) bagus untuk menangkap kejadian, tetapi tidak bisa menjawab
 * **apa perkembangan anggota ini dari waktu ke waktu**.
 *
 * Halaman ini menilai empat aspek yang **tidak bisa dihitung dari data**:
 * teknik, musikalitas, kedisiplinan, kerjasama. Kehadiran sengaja tidak
 * dinilai di sini — ia sudah terukur dari data absensi, dan menilainya manual
 * akan membuat dua angka untuk hal yang sama.
 *
 * Semua hitungan ada di `lib/evaluasi.ts` (murni, teruji di node); halaman
 * ini hanya menyajikan.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { NamaTampil, useModeNama } from '../components/NamaTampil'
import { PanelSetoranHafalan } from '../components/PanelSetoranHafalan'
import { namaTampil, bacaModeNama } from '../lib/namaAnggota'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { AspekEvaluasi, Evaluasi } from '../db/types'
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  StatTile,
  Textarea,
  useToast,
} from '../components/ui'
import { IconPlus, IconUsers } from '../components/Icons'
import { cx, sectionLabel, todayISO, uid } from '../lib/utils'
import {
  LABEL_ASPEK,
  MAX_NILAI,
  MIN_NILAI,
  URUTAN_ASPEK,
  formatNilai,
  formatTren,
  perluPerhatian,
  rataTim,
  ringkasan,
  terbaru,
  tren,
  warnaNilai,
  warnaTren,
} from '../lib/evaluasi'

export default function Evaluasi() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabAktif: 'berkala' | 'setoran' =
    searchParams.get('tab') === 'setoran' ? 'setoran' : 'berkala'
  const members = useLiveQuery(() => db.members.toArray(), [], [])
  const daftar = useLiveQuery(() => db.evaluasi.toArray(), [], [])
  const jmlTargetSetoran = useLiveQuery(() => db.targetSetoran.count(), [], 0)

  function pilihTab(tab: 'berkala' | 'setoran') {
    const p = new URLSearchParams(searchParams)
    if (tab === 'setoran') p.set('tab', 'setoran')
    else p.delete('tab')
    setSearchParams(p, { replace: true })
  }

  const [saring, setSaring] = useState<string>('all')
  const [urut, setUrut] = useState<'nama' | 'nilai' | 'tren'>('nama')
  const [sunting, setSunting] = useState<{ memberId: string; nama: string } | null>(null)
  const [riwayat, setRiwayat] = useState<{ memberId: string; nama: string } | null>(null)

  /** Evaluasi per anggota, dan ringkasannya. */
  const perAnggota = useMemo(() => {
    const peta = new Map<string, Evaluasi[]>()
    for (const e of daftar ?? []) {
      const l = peta.get(e.memberId) ?? []
      l.push(e)
      peta.set(e.memberId, l)
    }
    return peta
  }, [daftar])

  const baris = useMemo(() => {
    const out = (members ?? [])
      .filter((m) => saring === 'all' || m.section === saring)
      .filter((m) => m.active !== 0)
      .map((m) => {
        const l = perAnggota.get(m.id) ?? []
        const r = ringkasan(l)
        return { member: m, ...r, terakhir: terbaru(l) }
      })
    if (urut === 'nama') out.sort((a, b) => namaTampil(a.member, bacaModeNama()).localeCompare(namaTampil(b.member, bacaModeNama()), 'id'))
    else if (urut === 'nilai') out.sort((a, b) => (b.rata ?? -1) - (a.rata ?? -1))
    else out.sort((a, b) => (b.tren ?? -99) - (a.tren ?? -99))
    return out
  }, [members, perAnggota, saring, urut])

  const rata = useMemo(() => rataTim(daftar ?? []), [daftar])
  const perhatian = useMemo(() => perluPerhatian(daftar ?? [], 3), [daftar])
  const perluPerhatianId = useMemo(() => new Set(perhatian.map((p) => p.memberId)), [perhatian])

  const sections = useMemo(() => {
    const s = new Set((members ?? []).map((m) => m.section))
    return [...s]
  }, [members])

  async function hapus(id: string) {
    await db.evaluasi.delete(id)
    toast.push('Evaluasi dihapus', 'info')
  }

  return (
    <div>
      <PageHeader
        title="Evaluasi & kemajuan"
        subtitle="Nilai perkembangan 4 aspek berkala dan pantau matriks setoran hafalan tim"
        actions={
          tabAktif === 'berkala' ? (
            <Button
              variant="primary"
              data-testid="tambah-evaluasi"
              onClick={() => setSunting({ memberId: baris[0]?.member.id ?? '', nama: baris[0] ? namaTampil(baris[0].member, bacaModeNama()) : '' })}
              disabled={baris.length === 0}
            >
              <IconPlus size={16} /> Nilai anggota
            </Button>
          ) : undefined
        }
      />

      <div
        data-testid="bar-tab-evaluasi"
        className="mb-4 flex flex-wrap gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 p-1"
      >
        <button
          type="button"
          data-testid="tab-evaluasi-berkala"
          onClick={() => pilihTab('berkala')}
          className={cx(
            'flex-1 rounded-md px-3 py-2 text-xs font-semibold transition',
            tabAktif === 'berkala'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-slate-100',
          )}
        >
          Evaluasi Berkala (4 Aspek)
        </button>
        <button
          type="button"
          data-testid="tab-setoran-hafalan"
          onClick={() => pilihTab('setoran')}
          className={cx(
            'flex-1 rounded-md px-3 py-2 text-xs font-semibold transition',
            tabAktif === 'setoran'
              ? 'bg-emerald-600 text-white'
              : 'text-slate-400 hover:text-slate-100',
          )}
        >
          Matriks Setoran Hafalan
          {jmlTargetSetoran > 0 ? ` (${jmlTargetSetoran})` : ''}
        </button>
      </div>

      {tabAktif === 'setoran' ? (
        <PanelSetoranHafalan />
      ) : (
        <>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Rata-rata tim"
          value={formatNilai(rata)}
          sub="dari evaluasi terakhir tiap anggota"
        />
        <StatTile
          label="Sudah dievaluasi"
          value={String(perAnggota.size)}
          sub={`dari ${(members ?? []).filter((m) => m.active !== 0).length} anggota aktif`}
        />
        <StatTile
          label="Perlu perhatian"
          value={String(perhatian.length)}
          sub="rata-rata di bawah 3,0"
          accent={perhatian.length ? 'text-amber-300' : undefined}
        />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Section</label>
            <Select data-testid="saring-section" value={saring} onChange={(e) => setSaring(e.target.value)} className="min-w-[10rem]">
              <option value="all">Semua section</option>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {sectionLabel(s)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Urutkan</label>
            <Select data-testid="urut-evaluasi" value={urut} onChange={(e) => setUrut(e.target.value as 'nama' | 'nilai' | 'tren')} className="min-w-[10rem]">
              <option value="nama">Nama</option>
              <option value="nilai">Nilai tertinggi</option>
              <option value="tren">Perkembangan terbaik</option>
            </Select>
          </div>
          <p className="pb-1 text-[11px] leading-relaxed text-slate-500">
            Kehadiran <b>tidak</b> dinilai di sini — ia sudah terukur dari data absensi dan bisa
            dilihat di menu <b>Absensi → Rekap</b>.
          </p>
        </div>
      </Card>

      {baris.length === 0 ? (
        <EmptyState icon={<IconUsers size={28} />} title="Belum ada anggota aktif." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Anggota</th>
                  <th className="py-2 pr-3">Section</th>
                  {URUTAN_ASPEK.map((a) => (
                    <th key={a} className="py-2 pr-3 text-center">
                      {LABEL_ASPEK[a]}
                    </th>
                  ))}
                  <th className="py-2 pr-3 text-center">Rata</th>
                  <th className="py-2 pr-3">Perkembangan</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => (
                  <tr
                    key={b.member.id}
                    data-testid={`baris-${b.member.id}`}
                    className="border-b border-slate-800/60 last:border-0"
                  >
                    <td className="py-2 pr-3">
                      <span className="text-slate-100"><NamaTampil anggota={b.member} /></span>
                      {perluPerhatianId.has(b.member.id) && (
                        <span
                          data-testid={`perhatian-${b.member.id}`}
                          className="ml-2 rounded border border-amber-600/40 px-1.5 py-0.5 text-[10px] text-amber-300"
                        >
                          perhatian
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-slate-400">{sectionLabel(b.member.section)}</td>
                    {URUTAN_ASPEK.map((a) => (
                      <td key={a} className={`py-2 pr-3 text-center tabular-nums ${warnaNilai(b.perAspek[a])}`}>
                        {formatNilai(b.perAspek[a])}
                      </td>
                    ))}
                    <td className={`py-2 pr-3 text-center font-semibold tabular-nums ${warnaNilai(b.rata)}`}>
                      <span data-testid={`rata-${b.member.id}`}>{formatNilai(b.rata)}</span>
                    </td>
                    <td className={`py-2 pr-3 tabular-nums ${warnaTren(b.tren)}`}>
                      <span data-testid={`tren-${b.member.id}`}>{formatTren(b.tren)}</span>
                      {b.jumlah > 0 && (
                        <button
                          data-testid={`riwayat-${b.member.id}`}
                          onClick={() => setRiwayat({ memberId: b.member.id, nama: namaTampil(b.member, bacaModeNama()) })}
                          className="ml-2 text-[11px] text-slate-500 underline hover:text-slate-300"
                        >
                          {b.jumlah} kali
                        </button>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`nilai-${b.member.id}`}
                        onClick={() => setSunting({ memberId: b.member.id, nama: namaTampil(b.member, bacaModeNama()) })}
                      >
                        Nilai
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {sunting && (
        <ModalEvaluasi
          memberId={sunting.memberId}
          nama={sunting.nama}
          daftarAnggota={(members ?? []).filter((m) => m.active !== 0)}
          onClose={() => setSunting(null)}
        />
      )}
      {riwayat && (
        <ModalRiwayat
          memberId={riwayat.memberId}
          nama={riwayat.nama}
          onClose={() => setRiwayat(null)}
          onHapus={hapus}
        />
      )}
        </>
      )}
    </div>
  )
}

/* ========================================================================== */

/** Pilihan nilai 1–5 berupa tombol besar — dipakai sambil berdiri, bukan duduk. */
function PilihNilai({
  nilai,
  onChange,
  testId,
}: {
  nilai: number | null
  onChange: (n: number | null) => void
  testId: string
}) {
  const angka = []
  for (let i = MIN_NILAI; i <= MAX_NILAI; i += 1) angka.push(i)
  return (
    <div className="flex items-center gap-1">
      {angka.map((n) => (
        <button
          key={n}
          type="button"
          data-testid={`${testId}-${n}`}
          onClick={() => onChange(nilai === n ? null : n)}
          className={`h-9 w-9 rounded-lg border text-sm font-semibold tabular-nums transition ${
            nilai === n
              ? 'border-emerald-500 bg-emerald-500 text-slate-950'
              : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
          }`}
        >
          {n}
        </button>
      ))}
      <span className="ml-2 text-[11px] text-slate-600">{nilai == null ? 'tidak dinilai' : 'ketuk lagi untuk membatalkan'}</span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function ModalEvaluasi({
  memberId,
  nama,
  daftarAnggota,
  onClose,
}: {
  memberId: string
  nama: string
  daftarAnggota: { id: string; name: string; panggilan?: string }[]
  onClose: () => void
}) {
  const toast = useToast()
  const modeNama = useModeNama()
  const [pilih, setPilih] = useState(memberId)
  const [tanggal, setTanggal] = useState(todayISO())
  const [nilai, setNilai] = useState<Partial<Record<AspekEvaluasi, number>>>({})
  const [catatan, setCatatan] = useState('')

  const ketemu = daftarAnggota.find((m) => m.id === pilih)
  const terpilih = ketemu ? namaTampil(ketemu, modeNama) : nama

  async function simpan() {
    if (!pilih) {
      toast.push('Pilih anggotanya dulu', 'err')
      return
    }
    if (!Object.keys(nilai).length && !catatan.trim()) {
      toast.push('Isi minimal satu aspek atau catatan', 'err')
      return
    }
    await db.evaluasi.put({
      id: uid('ev_'),
      memberId: pilih,
      tanggal,
      nilai,
      catatan: catatan.trim() || undefined,
      oleh: 'Pelatih',
      createdAt: Date.now(),
    })
    onClose()
    toast.push(`Evaluasi ${terpilih} disimpan`)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Nilai anggota"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" data-testid="simpan-evaluasi" onClick={simpan}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Anggota">
          <Select data-testid="pilih-anggota" value={pilih} onChange={(e) => setPilih(e.target.value)}>
            {daftarAnggota.map((m) => (
              <option key={m.id} value={m.id}>
                <NamaTampil anggota={m} />
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tanggal">
          <Input data-testid="tanggal-evaluasi" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </Field>
      </div>

      <p className="mb-2 mt-3 text-xs text-slate-400">
        Aspek boleh dinilai sebagian — menilai kerjasama tanpa menilai teknik itu sah.
      </p>
      <div className="space-y-2">
        {URUTAN_ASPEK.map((a) => (
          <div key={a} className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-200">{LABEL_ASPEK[a]}</span>
            <PilihNilai
              testId={`nilai-${a}`}
              nilai={nilai[a] ?? null}
              onChange={(n) => {
                const salin = { ...nilai }
                if (n == null) delete salin[a]
                else salin[a] = n
                setNilai(salin)
              }}
            />
          </div>
        ))}
      </div>

      <Field label="Catatan" hint="opsional">
        <Textarea
          data-testid="catatan-evaluasi"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Yang perlu ditingkatkan, hal yang sudah membaik, dan sebagainya."
        />
      </Field>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */

function ModalRiwayat({
  memberId,
  nama,
  onClose,
  onHapus,
}: {
  memberId: string
  nama: string
  onClose: () => void
  onHapus: (id: string) => void
}) {
  const daftar = useLiveQuery(
    () => db.evaluasi.where('memberId').equals(memberId).toArray(),
    [memberId],
    [],
  )
  const urut = useMemo(() => (daftar ?? []).slice().sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1)), [daftar])

  return (
    <Modal open onClose={onClose} title={`Riwayat — ${nama}`}>
      {urut.length === 0 ? (
        <p className="text-sm text-slate-500">Belum pernah dievaluasi.</p>
      ) : (
        <ul className="space-y-2" data-testid="daftar-riwayat">
          {urut.map((e, i) => {
            const r = ringkasan([e])
            // Tren antar dua evaluasi berturutan dalam riwayat ini.
            const t = tren([urut[i + 1], e].filter(Boolean))
            return (
              <li key={e.id} data-testid={`riwayat-${e.id}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-200">{e.tanggal}</span>
                  <span className={`text-xs tabular-nums ${warnaNilai(r.rata)}`}>
                    rata {formatNilai(r.rata)}
                  </span>
                </div>
                <div className="mb-1.5 flex flex-wrap gap-2">
                  {URUTAN_ASPEK.filter((a) => r.perAspek[a] != null).map((a) => (
                    <span
                      key={a}
                      className={`rounded border border-slate-700 px-1.5 py-0.5 text-[11px] tabular-nums ${warnaNilai(r.perAspek[a])}`}
                    >
                      {LABEL_ASPEK[a]} {formatNilai(r.perAspek[a])}
                    </span>
                  ))}
                  {URUTAN_ASPEK.every((a) => r.perAspek[a] == null) && (
                    <span className="text-[11px] text-slate-600">tidak ada aspek yang dinilai</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] ${warnaTren(t)}`}>
                    {t == null ? 'belum bisa dibandingkan' : formatTren(t)}
                  </span>
                  <button
                    data-testid={`hapus-${e.id}`}
                    onClick={() => void onHapus(e.id)}
                    className="rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                  >
                    Hapus
                  </button>
                </div>
                {e.catatan && <p className="mt-1.5 whitespace-pre-wrap text-xs text-slate-400">{e.catatan}</p>}
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">
        Perkembangan dihitung hanya pada aspek yang dinilai di <b>kedua</b> evaluasi. Kalau
        himpunan aspeknya tidak bersinggungan, ia ditandai “belum bisa dibandingkan” daripada
        mengarang angkanya.
      </p>
    </Modal>
  )
}
