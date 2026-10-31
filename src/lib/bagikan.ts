/**
 * Menyusun **dua jenis paket berbagi** — satu untuk grup, satu per anggota.
 *
 * Mengapa harus dua: selama 18 anggota menerima **satu berkas yang sama**,
 * maka data pribadi 18 orang harus ada di dalam berkas itu. Ini bukan
 * kebetulan yang bisa diperbaiki dengan menyaring tampilan — yang bocor
 * adalah **berkasnya**, bukan layarnya. Menyaring tampilan memberi rasa aman
 * palsu: anggota yang membuka berkas `.json` dengan editor teks tetap
 * melihat absensi, catatan evaluasi, nomor telepon, dan catatan pribadi
 * pelatih tentang 17 rekannya.
 *
 * Karena itu dua pekerjaan ini dipisahkan:
 *
 * - **Berkas grup** — data bersama saja. Aman dibagikan ke mana saja,
 *   termasuk grup terbuka. Satu pesan untuk semua orang.
 * - **Berkas per anggota** — satu berkas per anak, masing-masing hanya
 *   memuat data pribadinya sendiri. Dibungkus ZIP supaya cukup satu kali
 *   klik, dan tiap berkas dinamai menurut anggotanya supaya mudah dikirim.
 *
 * **Nilai evaluasi terstruktur (H2) tidak pernah ikut**, baik di grup maupun
 * per anggota. Keputusan ini diambil pemakainya: yang sampai ke anggota
 * hanya **tulisan pelatih**, bukan angkanya. Nilai 1–5 adalah penilaian
 * tentang seseorang, dan penilaian tentang seseorang tidak perlu ikut
 * berkeliaran di dalam berkas yang bisa diteruskan siapa saja.
 */
import type { Member, ShareBundle } from '../db/types'
import { namaDenganPanggilan } from './namaAnggota'
import { namaPaketAnggota } from './bukaBerkas'
import { saringPartiturPaketUntukAnggota } from './partiturPaket'

/**
 * Kolom yang **tidak pernah** meninggalkan perangkat pelatih.
 *
 * - `token` — kunci QR absensi; siapa pun yang memilikinya bisa absen
 *   atas nama orang lain.
 * - `phone` — nomor telepon pribadi anggota.
 * - `notes` — catatan pelatih tentang anggota itu, untuk pelatih sendiri.
 */
export type KolomRahasia = 'token' | 'phone' | 'notes'

/**
 * Anggota tanpa kolom rahasianya.
 *
 * Yang **tetap** dipertahankan: `id`, `code`, `name`, `panggilan`, `alias`,
 * `section`, `instrument`, `role`, `joinYear`, `active`. Semua itu diperlukan
 * supaya anggota bisa memilih namanya — lengkap maupun panggilan — dan melihat
 * formasinya di antara rekan-rekannya.
 */
export function bersihkanAnggota(m: Member): Member {
  const { token: _token, phone: _phone, notes: _notes, ...sisa } = m
  return { ...sisa, token: '' } as Member
}

/**
 * Paket untuk **satu berkas yang dibagikan ke semua orang**.
 *
 * Tidak memuat absensi maupun catatan evaluasi siapa pun. Anggota tetap
 * mendapat jadwal, materi, formasi, dan repertoar — yang memang milik
 * bersama.
 */
export function paketGrup(b: ShareBundle): ShareBundle {
  return {
    ...b,
    members: b.members.map(bersihkanAnggota),
    attendance: [],
    memberNotes: [],
    // #14 — targetSetoran (kurikulum tim) boleh terbawa lewat `...b`, tetapi
    // capaian pribadi `setoran` WAJIB dikosongkan di paket grup.
    setoran: [],
    mode: 'member',
    /*
     * Berkas grup bukan untuk siapa pun secara khusus — dibagikan ke semua
     * orang. Jadi penanda penerimanya dibuang, bukan sekadar tidak diisi:
     * kalau `b` berasal dari paket per anggota, penandanya akan ikut
     * terbawa lewat `...b` dan semua orang diidentifikasi sebagai orang
     * yang sama.
     */
    forMember: undefined,
    namaPenerima: undefined,
  }
}

/**
 * Paket untuk **satu anggota**: hanya absensi, catatan, dan setoran hafalan miliknya sendiri.
 *
 * `memberId` yang tidak dikenal tidak menghasilkan data pribadi apa pun —
 * bukan malah mengembalikan semuanya. Mengembalikan semuanya adalah
 * kegagalan yang paling berbahaya karena ia tampak "berhasil".
 */
export function paketAnggota(b: ShareBundle, memberId: string): ShareBundle {
  const penerima = b.members.find((m) => m.id === memberId)
  const dikenal = !!penerima
  // #13a — untuk berkas per anggota, saring partitur MusicXML agar hanya memuat
  // suara/seksi milik anggota penerima. Untuk `memberId` tak dikenal, jangan
  // bocorkan lampiran apa pun.
  const tersaring =
    dikenal && penerima && b.partiturPaket
      ? saringPartiturPaketUntukAnggota(b.partiturPaket, b.songs ?? [], penerima, b.team?.sections)
      : { partiturPaket: undefined, songs: b.songs ?? [] }
  return {
    ...b,
    songs: tersaring.songs,
    partiturPaket: tersaring.partiturPaket,
    members: b.members.map(bersihkanAnggota),
    targetSetoran: dikenal ? (b.targetSetoran ?? []) : [],
    countSheets: dikenal ? (b.countSheets ?? []) : [],
    attendance: dikenal ? b.attendance.filter((a) => a.memberId === memberId) : [],
    memberNotes: dikenal ? (b.memberNotes ?? []).filter((n) => n.memberId === memberId) : [],
    setoran: dikenal ? (b.setoran ?? []).filter((s) => s.memberId === memberId) : [],
    mode: 'member',
    /*
     * Tulis **untuk siapa** berkas ini, supaya yang membukanya tidak
     * disuruh memilih namanya dari seluruh daftar anggota — ia sudah
     * tercantum di berkasnya sendiri.
     *
     * Tetap `undefined` bila `memberId` tidak dikenal: menyebut seorang
     * anggota sebagai penerima padahal datanya tidak disertakan akan
     * mengidentifikasi orang yang salah.
     *
     * `namaPenerima` menulis kedua namanya ("Andra Pratama (Dede)") supaya
     * berkasnya tetap dikenali, apa pun nama yang dipakai di lapangan.
     */
    forMember: dikenal ? memberId : undefined,
    namaPenerima: penerima ? namaDenganPanggilan(penerima) : undefined,
  }
}

/**
 * Nama berkas yang jelas untuk anggota ini, mis.
 * `DrillKit - UNTUK ANGGOTA - Andra Pratama (Dede) A07.json` (#7 B).
 *
 * Nama ditulis apa adanya (dengan spasi) supaya langsung dikenali di daftar
 * unduhan, panggilan ditulis dalam kurung, dan kode anggota dipakai sebagai
 * pembeda karena nama bisa saja sama. Huruf beraksen tetap dibuang (tidak
 * semua sistem berkas menyukainya) dan karakter terlarang dibersihkan.
 */
export function namaBerkasAnggota(m: Member): string {
  return namaPaketAnggota(m.name ?? '', m.panggilan, m.code || m.id || 'tanpa-kode')
}
