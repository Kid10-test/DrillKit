/**
 * v2.15.2 — lepas tautan pencocokan (alias) — uji logika murni.
 *
 * Kasus nyata yang memicunya: dua orang bernama mirip ("Raka" di brass dan
 * "Raka Wijaya" di perkusi) pernah tercocokkan, sehingga id lama si brass
 * tersimpan sebagai alias si perkusi. Yang harus tetap benar:
 * - `daftarTautan` menandai alias yang masih dimiliki anggota lain
 * - `lepasAlias` membuang alias dan mencatatnya di `aliasDilepas`;
 *   `pulihkanAlias` membatalkannya
 * - pulihkan backup lama yang masih memuat alias itu tidak memasangnya lagi
 * - impor berkas dengan id lama tidak dicocokkan otomatis ke orang yang salah,
 *   baik lewat alias lokal maupun lewat alias yang dibawa berkas
 * - pilihan pelatih saat impor dan gabung manual tetap menang
 * - saran anggota ganda tidak lagi mengusulkan pasangan yang sudah dilepas
 * - sinkron kehadiran bersama: tautan yang dilepas ikut terkirim dan tidak
 *   ditimpa server yang belum tahu
 */
import {
  daftarTautan,
  lepasAlias,
  pulihkanAlias,
  rencanakanGabung,
  sarankanGanda,
  susunSaran,
  terapkanCocok,
} from '/tmp/namaAnggota.mjs'
import { dataAnggota, terapkanAnggota } from '/tmp/kehadiranBersama.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) lulus += 1
  else gagal.push(`${nama}${keterangan ? ' — ' + keterangan : ''}`)
}

const anggota = (id, name, extra = {}) => ({
  code: '',
  section: 'brass',
  instrument: '',
  role: 'member',
  joinYear: 2025,
  active: 1,
  token: `t_${id}`,
  createdAt: 1,
  ...extra,
  id,
  name,
})

// Keadaan "salah" seperti di backup: si perkusi menyimpan dua id lama.
const ID_LAMA_BRASS = 'm_brass_lama' // masih ada sebagai anggota nonaktif
const ID_YATIM = 'm_yatim' // tidak ada lagi di daftar
const perkusi = anggota('m_perkusi', 'Raka Wijaya', {
  section: 'perkusi',
  code: 'CAB-017',
  panggilan: 'Raka',
  alias: [ID_YATIM, ID_LAMA_BRASS],
})
const brassLama = anggota(ID_LAMA_BRASS, 'Raka', {
  code: 'B28',
  instrument: 'Baritone 2',
  active: 0,
  panggilan: 'Raka Wijaya',
  alias: [ID_YATIM],
})
const semua = [perkusi, brassLama]

// ------------------------------------------------------------ daftarTautan
{
  const t = daftarTautan(perkusi, semua)
  cek('dua tautan terdaftar', t.length === 2, JSON.stringify(t))
  const b = t.find((x) => x.id === ID_LAMA_BRASS)
  cek('tautan ke anggota yang masih ada ditandai', b?.anggota?.name === 'Raka' && b.anggota.code === 'B28')
  const y = t.find((x) => x.id === ID_YATIM)
  cek('id yatim tanpa anggota', y && !y.anggota)
  cek('id yatim juga tertaut di brass lama', y?.jugaDi.length === 1 && y.jugaDi[0].id === ID_LAMA_BRASS)
  cek('anggota tanpa alias → daftar kosong', daftarTautan(anggota('x', 'X'), semua).length === 0)
}

// ------------------------------------------------------- lepas & pulihkan
const dilepas = lepasAlias(perkusi, ID_LAMA_BRASS)
{
  cek('alias terbuang', !(dilepas.alias ?? []).includes(ID_LAMA_BRASS))
  cek('alias lain tetap', (dilepas.alias ?? []).includes(ID_YATIM))
  cek('tercatat di aliasDilepas', (dilepas.aliasDilepas ?? []).includes(ID_LAMA_BRASS))
  cek('lepas murni (asli tidak berubah)', perkusi.alias.length === 2 && !perkusi.aliasDilepas)
  const dua = lepasAlias(dilepas, ID_LAMA_BRASS)
  cek('lepas dua kali tidak menggandakan', dua.aliasDilepas.length === 1)
  const batal = pulihkanAlias(dilepas, ID_LAMA_BRASS)
  cek('pulihkan → alias kembali', (batal.alias ?? []).includes(ID_LAMA_BRASS))
  cek('pulihkan → aliasDilepas kosong dibuang', batal.aliasDilepas === undefined)
  const habis = lepasAlias(lepasAlias(perkusi, ID_LAMA_BRASS), ID_YATIM)
  cek('semua dilepas → field alias hilang', habis.alias === undefined)
}

const lokalSesudah = [dilepas, brassLama]

// -------------------------------------------- pulihkan backup lama (restore)
{
  // Backup lama memuat si perkusi dengan dua alias dan si brass seperti dulu.
  const hasil = terapkanCocok({
    masuk: [perkusi, brassLama],
    lokal: lokalSesudah,
    keputusan: {},
    arah: 'lokal',
    timpaSamaId: true,
  })
  const p = hasil.anggotaTulis.find((m) => m.id === 'm_perkusi')
  cek('restore: perkusi tetap ditulis', !!p)
  cek('restore: tautan yang dilepas tidak kembali', !(p?.alias ?? []).includes(ID_LAMA_BRASS), JSON.stringify(p?.alias))
  cek('restore: aliasDilepas tetap', (p?.aliasDilepas ?? []).includes(ID_LAMA_BRASS))
  cek('restore: alias lain tetap', (p?.alias ?? []).includes(ID_YATIM))
  cek('restore: brass lama tetap orang sendiri', hasil.peta[ID_LAMA_BRASS] === undefined)
}

// ------------------------------------- impor berkas dengan id lama si brass
{
  // Perangkat ini sudah tidak punya anggota brass lama (mis. sudah dihapus).
  const lokal = [dilepas]
  const saran = susunSaran([brassLama], lokal)
  cek('impor: id lama tidak dicocokkan otomatis', !saran[0].otomatis, JSON.stringify(saran[0]))

  // Berkas membawa alias yang menunjuk balik ke si perkusi.
  const brassBawaAlias = { ...brassLama, alias: ['m_perkusi'] }
  const saran2 = susunSaran([brassBawaAlias], lokal)
  cek('impor: alias dari berkas juga tidak menautkan', !saran2[0].otomatis)

  const hasil = terapkanCocok({ masuk: [brassBawaAlias], lokal, keputusan: { [ID_LAMA_BRASS]: { jenis: 'baru' } }, arah: 'lokal' })
  cek('impor: tanpa keputusan "sama" → tidak dipetakan', hasil.peta[ID_LAMA_BRASS] === undefined)

  // Sebelum dilepas, jalur otomatis memang mencocokkan (perilaku lama tetap).
  const lama = susunSaran([brassLama], [perkusi])
  cek('kontrol: sebelum dilepas tetap otomatis', lama[0].otomatis?.idLokal === 'm_perkusi')
}

// ------------------------------------------- pilihan pelatih tetap menang
{
  const hasil = terapkanCocok({
    masuk: [brassLama],
    lokal: [dilepas],
    keputusan: { [ID_LAMA_BRASS]: { jenis: 'sama', idLokal: 'm_perkusi' } },
    arah: 'lokal',
  })
  const p = hasil.anggotaTulis.find((m) => m.id === 'm_perkusi')
  cek('pilihan: dipetakan ke perkusi', hasil.peta[ID_LAMA_BRASS] === 'm_perkusi')
  cek('pilihan: alias terpasang lagi', (p?.alias ?? []).includes(ID_LAMA_BRASS))
  cek('pilihan: tidak lagi di aliasDilepas', !(p?.aliasDilepas ?? []).includes(ID_LAMA_BRASS))
}

// ------------------------------------------------------- gabung manual
{
  const kosong = { absensi: [], evaluasi: [], catatan: [], sets: [], drills: [], riwayat: [], kemajuan: [] }
  const r = rencanakanGabung({ simpan: dilepas, buang: brassLama, ...kosong })
  cek('gabung: rencana ada', !!r)
  cek('gabung manual memasang tautan lagi', (r?.simpan.alias ?? []).includes(ID_LAMA_BRASS))
  cek('gabung manual menghapus dari aliasDilepas', !(r?.simpan.aliasDilepas ?? []).includes(ID_LAMA_BRASS))
}

// ------------------------------------------------------- saran ganda
{
  const jejak = { absensi: [], posisi: [] }
  const a = anggota('m_a', 'Dimas', { code: 'T1' })
  const b = anggota('m_b', 'Dimas', { code: 'T1' })
  cek('kontrol: nama & kode sama → disarankan', sarankanGanda([a, b], jejak).length === 1)
  const a2 = lepasAlias({ ...a, alias: ['m_b'] }, 'm_b')
  cek('sudah dilepas → tidak disarankan lagi', sarankanGanda([a2, b], jejak).length === 0)
}

// ----------------------------------------------- kehadiran bersama (sinkron)
{
  const d = dataAnggota(dilepas)
  cek('sinkron: aliasDilepas ikut terkirim', (d.aliasDilepas ?? []).includes(ID_LAMA_BRASS))
  cek('sinkron: anggota tanpa pelepasan tidak membawa field', !('aliasDilepas' in dataAnggota(brassLama)))
  // Server (perangkat versi lama) masih mengirim alias lama tanpa aliasDilepas.
  const dariServer = dataAnggota(perkusi)
  const r = terapkanAnggota(dilepas, dariServer, () => 'tok', 5)
  cek('sinkron: server lama tidak memasang tautan lagi', !(r.alias ?? []).includes(ID_LAMA_BRASS), JSON.stringify(r.alias))
  cek('sinkron: aliasDilepas lokal tidak hilang', (r.aliasDilepas ?? []).includes(ID_LAMA_BRASS))
  // Perangkat lain sudah melepas → perangkat ini ikut.
  const r2 = terapkanAnggota(perkusi, d, () => 'tok', 5)
  cek('sinkron: pelepasan dari server diikuti', !(r2.alias ?? []).includes(ID_LAMA_BRASS) && (r2.aliasDilepas ?? []).includes(ID_LAMA_BRASS))
}

console.log(`${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  for (const g of gagal) console.log('  ✗ ' + g)
  process.exit(1)
}
