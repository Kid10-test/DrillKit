/**
 * G3 — penanda mulai & selesai sesi.
 *
 * Dipakai di dua tempat: kartu jadwal (bisa menandai tanpa membuka apa pun)
 * dan layar Pacu Latihan (tempat pelatih berada saat sesi berjalan).
 * Keduanya memakai komponen yang sama supaya tidak ada dua tampilan untuk
 * satu keadaan.
 *
 * Yang sengaja tidak dilakukan di sini:
 *
 * - **Tidak pernah menyimpulkan penanda sesi dari blok.** Mulai blok
 *   pertama bukan mulai sesi; menyamakannya menyembunyikan keterlambatan
 *   yang paling umum.
 * - **Tidak pernah mengubah catatan blok.** Menandai sesi selesai tidak
 *   menutup blok yang masih berjalan — yang dilakukannya hanya
 *   memperingatkan bahwa ada blok yang menggantung.
 * - **Tidak pernah mengisi penanda secara otomatis.** Penanda yang diisi
 *   sendiri bukan penanda, melainkan tebakan.
 */
import { db } from '../db/db'
import type { Session } from '../db/types'
import {
  formatDurasi,
  formatLampau,
  formatTelat,
  jamDariEpoch,
  rataLampau,
  rataTelat,
  ringkasanSesi,
  warnaTelat,
} from '../lib/sesi'
import { Button, Card, Input } from './ui'
import { epochRencana } from '../lib/sesi'

const LABEL_STATUS = {
  belum: 'Belum dimulai',
  berjalan: 'Sedang berjalan',
  rampung: 'Sudah rampung',
} as const

const WARNA_STATUS = {
  belum: 'bg-slate-700 text-slate-300',
  berjalan: 'bg-sky-500/20 text-sky-300',
  rampung: 'bg-emerald-500/20 text-emerald-300',
} as const

export function PenandaSesi({ s, ringkas = false }: { s: Session; ringkas?: boolean }) {
  const r = ringkasanSesi(s)

  /**
   * Penanda ditulis dengan **get lalu put**, bukan `update`.
   *
   * Alasannya: menghapus penanda berarti **membuang kuncinya**, dan `update`
   * dengan nilai `undefined` tidak bisa diandalkan untuk itu. Mengambil
   * rekaman segar lebih dulu juga menghindari menimpa perubahan yang terjadi
   * setelah kartu ini terakhir kali dirender.
   */
  async function tulis(ubah: (x: Session) => void) {
    const segar = await db.sessions.get(s.id)
    if (!segar) return
    ubah(segar)
    await db.sessions.put(segar)
  }

  function mulai() {
    return tulis((x) => {
      x.mulaiNyata = Date.now()
      delete x.selesaiNyata
    })
  }

  function selesai() {
    return tulis((x) => {
      x.selesaiNyata = Date.now()
    })
  }

  function tandaiUlang() {
    return tulis((x) => {
      delete x.mulaiNyata
      delete x.selesaiNyata
    })
  }

  /**
   * Menyunting jam penanda.
   *
   * Ada satu keadaan yang tidak bisa ditangani oleh tombol saja: **pelatih
   * lupa menekan "Mulai sesi"**, dan baru menyadarinya esok hari. Tanpa
   * suntingan ini, satu-satunya jalan keluar adalah menghapus penanda —
   * padahal jam mulainya diketahui. Penanda yang tidak bisa diperbaiki
   * akhirnya tidak ditandai sama sekali.
   *
   * Jamnya disimpan pada **tanggal sesinya**, bukan hari ini, supaya
   * memperbaiki penanda kemarin tidak mengubah maknanya menjadi hari ini.
   */
  function ubahJam(yang: 'mulai' | 'selesai', jam: string) {
    const e = epochRencana(s.date, jam)
    if (e == null) return
    return tulis((x) => {
      if (yang === 'mulai') x.mulaiNyata = e
      else x.selesaiNyata = e
    })
  }

  return (
    <div
      className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3"
      data-testid={`penanda-${s.id}`}
      data-status={r.status}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-[11px] font-semibold ${WARNA_STATUS[r.status]}`}
            data-testid={`status-sesi-${s.id}`}
          >
            {LABEL_STATUS[r.status]}
          </span>
          <span className="text-xs text-slate-400">
            Rencana {s.startTime}–{s.endTime}
          </span>
          {r.mulaiNyata != null && (
            <span className="text-xs font-medium text-slate-200" data-testid={`mulai-nyata-${s.id}`}>
              · Nyata {jamDariEpoch(r.mulaiNyata)}
              {r.selesaiNyata != null ? `–${jamDariEpoch(r.selesaiNyata)}` : '–…'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {r.status === 'belum' && (
            <Button size="sm" data-testid={`mulai-sesi-${s.id}`} onClick={mulai}>
              Mulai sesi
            </Button>
          )}
          {r.status === 'berjalan' && (
            <Button size="sm" data-testid={`selesai-sesi-${s.id}`} onClick={selesai}>
              Selesai sesi
            </Button>
          )}
          {r.status !== 'belum' && (
            <Button size="sm" variant="ghost" data-testid={`ulang-sesi-${s.id}`} onClick={tandaiUlang}>
              Tandai ulang
            </Button>
          )}
        </div>
      </div>

      {r.status !== 'belum' && (
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <div>
            <label
              className="mb-1 block text-[11px] text-slate-500"
              htmlFor={`jam-mulai-${s.id}`}
            >
              Jam mulai nyata
            </label>
            <Input
              id={`jam-mulai-${s.id}`}
              type="time"
              data-testid={`jam-mulai-${s.id}`}
              className="w-28"
              value={r.mulaiNyata != null ? jamDariEpoch(r.mulaiNyata) : ''}
              onChange={(e) => ubahJam('mulai', e.target.value)}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-[11px] text-slate-500"
              htmlFor={`jam-selesai-${s.id}`}
            >
              Jam selesai nyata
            </label>
            <Input
              id={`jam-selesai-${s.id}`}
              type="time"
              data-testid={`jam-selesai-${s.id}`}
              className="w-28"
              value={r.selesaiNyata != null ? jamDariEpoch(r.selesaiNyata) : ''}
              onChange={(e) => ubahJam('selesai', e.target.value)}
            />
          </div>
          <p className="pb-1 text-[11px] text-slate-600">
            Bisa diisi belakangan — dipakai bila lupa menekan tombol saat itu.
          </p>
        </div>
      )}

      {r.hariLain && (
        <p
          className="mt-2 text-xs font-semibold text-amber-300"
          data-testid={`hari-lain-${s.id}`}
        >
          Penandanya jatuh di luar hari sesi ini, jadi selisihnya tidak dihitung. Gunakan
          “Tandai ulang” bila ini ketukan yang salah.
        </p>
      )}

      {!ringkas && r.status !== 'belum' && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Mulai</dt>
            <dd className={`font-semibold ${warnaTelat(r.telat)}`} data-testid={`telat-${s.id}`}>
              {formatTelat(r.telat)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Selesai</dt>
            <dd className="font-semibold text-slate-200" data-testid={`lampau-${s.id}`}>
              {formatLampau(r.lampau)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Durasi nyata</dt>
            <dd className="font-semibold tabular-nums text-slate-200" data-testid={`durasi-${s.id}`}>
              {formatDurasi(r.durasi)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Durasi rencana</dt>
            <dd className="tabular-nums text-slate-400">{formatDurasi(r.durasiRencana)}</dd>
          </div>
        </dl>
      )}

      {!ringkas && r.blokMenggantung > 0 && (
        <p className="mt-2 text-xs text-amber-300" data-testid={`menggantung-${s.id}`}>
          Ada {r.blokMenggantung} blok yang dimulai tetapi belum ditandai selesai. Penanda sesi
          tidak menutupnya — buka Pacu untuk merampungkannya.
        </p>
      )}
    </div>
  )
}

/**
 * Rekap penanda lintas sesi — bagian yang menjawab pertanyaannya.
 *
 * Satu sesi hanya bisa menggantung; baru beberapa sesi memberi pola.
 * Panel ini menjawab: **apakah kebiasaan kita terlambat?** — sesuatu yang
 * tidak bisa dijawab oleh penanda per sesi, dan tidak bisa dirasakan
 * andal dari ingatan.
 *
 * **Sesi mana yang dihitung.** Hanya sesi yang **waktu selesai rencananya
 * sudah lewat**. Ini penting: sesi yang baru akan terjadi besok belum bisa
 * ditandai, dan menyebutnya "belum ditandai" adalah **tuduhan yang salah**
 * — lebih buruk daripada tidak memberi angka sama sekali.
 *
 * **Yang sengaja tidak dilakukan:** sesi yang belum ditandai **tidak**
 * dihitung sebagai "tepat waktu". Bila dari 12 sesi lewat hanya 4 yang
 * ditandai, angkanya berasal dari 4 itu dan tertulis demikian — bukan
 * "rata-rata 3 menit" yang tercampur dari 8 sesi yang tidak pernah diukur.
 */
export function RekapPenanda({ sesi, sekarang = Date.now() }: { sesi: Session[]; sekarang?: number }) {
  /** Sesi yang seharusnya sudah selesai — inilah yang pantas ditandai. */
  const lewat = sesi.filter((s) => {
    const e = epochRencana(s.date, s.endTime)
    return e != null && e <= sekarang
  })

  const semua = lewat.map(ringkasanSesi)
  const telat = rataTelat(semua)
  const lampau = rataLampau(semua)
  const ditandai = semua.filter((r) => r.status !== 'belum').length
  const rampung = semua.filter((r) => r.status === 'rampung').length
  const belumDitandai = semua.length - ditandai
  const menggantung = semua.reduce((a, r) => a + r.blokMenggantung, 0)

  if (lewat.length === 0) return null

  return (
    <Card className="mb-4" data-testid="rekap-penanda">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Ketepatan waktu</h2>
        <p className="text-[11px] text-slate-500" data-testid="rekap-asal">
          {ditandai === 0
            ? `belum ada dari ${lewat.length} sesi yang sudah lewat`
            : `dari ${ditandai} sesi yang ditandai · ${rampung} di antaranya rampung`}
        </p>
      </div>

      {ditandai === 0 ? (
        <p className="mt-2 text-xs text-slate-500">
          Tekan <b>Mulai sesi</b> saat latihan dimulai dan <b>Selesai sesi</b> saat bubar. Tanpa
          penanda, ketepatan waktu hanya bisa dirasakan — tidak bisa dilihat.
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Rata-rata mulai</dt>
            <dd className={`mt-0.5 text-lg font-semibold ${warnaTelat(telat)}`} data-testid="rekap-telat">
              {formatTelat(telat)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Rata-rata selesai</dt>
            <dd className="mt-0.5 text-lg font-semibold text-slate-200" data-testid="rekap-lampau">
              {formatLampau(lampau)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Belum ditandai</dt>
            <dd className="mt-0.5 text-lg font-semibold text-slate-400" data-testid="rekap-belum">
              {belumDitandai}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Blok menggantung</dt>
            <dd className="mt-0.5 text-lg font-semibold text-slate-400" data-testid="rekap-menggantung">
              {menggantung}
            </dd>
          </div>
        </dl>
      )}

      {belumDitandai > 0 && ditandai > 0 && (
        <p className="mt-2 text-[11px] text-slate-500" data-testid="rekap-peringatan">
          {belumDitandai} sesi yang sudah lewat belum ditandai dan <b>tidak</b> ikut menghitung
          rata-rata di atas — sengaja, supaya sesi yang tidak diukur tidak tampak sebagai sesi yang
          tepat waktu.
        </p>
      )}
    </Card>
  )
}
