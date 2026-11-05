/**
 * #28 — Studio Perkusi (Battery & Pit): uji logika murni.
 *
 * Yang diuji:
 *   1. Lapisan sticking dasar terserap otomatis dari tiga gaya penulisan:
 *      `<words>` (MuseScore), lirik (Finale/Sibelius), `<fingering>`.
 *      Part non-perkusi dilewati; Pit bernada ikut.
 *   2. Pengenal alat: Snare (+rimshot), Tenor 1–3 + Spock, Bass 1–5 + Unison,
 *      akor Bass 2 + Bass 4 jadi satu peristiwa.
 *   3. Aksen, flam (not hias), diddle (tremolo 1), buzz (tremolo 3).
 *   4. Revisi lapangan: nilai sama dengan skor dibuang, diddle ⟂ buzz, ↺ asli,
 *      revisi yatim, `rapikanDaftarRevisi` menolak data rusak.
 *   5. Suntikan ke salinan XML: berkas asli tidak berubah, warna revisi hex,
 *      urai ulang menghasilkan nilai revisi & kunci yang sama, suara panduan
 *      ikut (flam/diddle/aksen), sticking baru untuk not tanpa sticking.
 *   6. Paket anggota (#13a): revisi hanya untuk part perkusi milik anggota;
 *      ciphertext pribadi tidak menduplikasi revisi.
 *   7. Pemanasan Timing Grid: panjang kotak = sticking, aksen bergeser, latih
 *      tempo, `rapikanBirama` memangkas sticking.
 *
 * Pakai: bash qa/bangun-logika.sh && node qa/perkusi-logika.mjs
 */
import {
  WARNA_REVISI_PERKUSI,
  gabungLapisanRevisi,
  labelAlatPeristiwa,
  peristiwaDalamBirama,
  rapikanDaftarRevisi,
  saringRevisiUntukPart,
  sisipkanRevisiPerkusi,
  terapkanUbahRevisi,
  teksStickingBirama,
  uraiLapisanPerkusi,
} from '/tmp/perkusiSticking.mjs'
import { klasifikasiNotPerkusi, peranDariNamaPart, nilaiLetak } from '/tmp/perkusiAlat.mjs'
import { uraiJadwalNadaMusicXml } from '/tmp/partiturBunyi.mjs'
import { buatLampiranPartiturPaket, saringAnotasiUntukPaket } from '/tmp/partiturPaket.mjs'
import { paketAnggota, paketGrup } from '/tmp/bagikan.mjs'
import { siapTerbitLengkap, muatBerkasTerbit, bukaDataPribadi } from '/tmp/terbit.mjs'
import { buatKunciBaru } from '/tmp/kunci.mjs'
import { ringkasMusicXml } from '/tmp/partitur.mjs'
import { DAFTAR_PEMANASAN_PERKUSI, susunPemanasanPerkusi } from '/tmp/pemanasanPerkusi.mjs'
import { rapikanBirama } from '/tmp/metronome.mjs'
import { SKOR_DRUMLINE } from './fikstur-perkusi.mjs'

let lulus = 0
const gagal = []
const cek = (nama, syarat, keterangan = '') => {
  if (syarat) {
    lulus += 1
    console.log(`  ✓ ${nama}`)
  } else {
    gagal.push(nama)
    console.log(`  ✗ ${nama}${keterangan ? ` — ${keterangan}` : ''}`)
  }
}

console.log('== 1–3. Lapisan sticking dasar & pengenal alat ==')
const lapisan = uraiLapisanPerkusi(SKOR_DRUMLINE)
const ev = (kunci) => lapisan.peristiwa.find((e) => e.kunci === kunci)
{
  cek('1. Empat part perkusi/pit terbaca, Trumpet dilewati', JSON.stringify(lapisan.parts.map((p) => `${p.id}:${p.peran}`)) === '["P1:snare","P2:tenor","P3:bass","P4:pit"]', JSON.stringify(lapisan.parts))
  const snare = lapisan.parts.find((p) => p.id === 'P1')
  cek('2. Snare: 11 not, 11 sticking terserap tanpa diketik ulang', snare.jumlahPeristiwa === 11 && snare.jumlahSticking === 11)
  const b1 = peristiwaDalamBirama(lapisan.peristiwa, 'P1', 1)
  cek('3. Sticking `<words>` gaya MuseScore: R L R R L R L L', teksStickingBirama(b1) === 'R L R R L R L L', teksStickingBirama(b1))
  const b2 = peristiwaDalamBirama(lapisan.peristiwa, 'P1', 2)
  cek('4. Sticking lirik gaya Finale/Sibelius terbaca (R L R)', teksStickingBirama(b2) === 'R L R')
  cek('5. Sticking `<fingering>` tenor terbaca (R L R L)', teksStickingBirama(peristiwaDalamBirama(lapisan.peristiwa, 'P2', 1)) === 'R L R L')
  cek('6. Pit bernada (Marimba) membawa sticking `<words>`', lapisan.parts.find((p) => p.id === 'P4').jumlahSticking === 4)
  cek('7. Aksen not 1, flam not 4 (not hias)', ev('P1|1|1|0').aksen === 1 && ev('P1|1|1|1.5').flam === 1 && ev('P1|1|1|0.5').flam === 0)
  cek('8. Rimshot dari nama instrumen "Rim Shot"', ev('P1|1|1|2.5').teknik === 'rimshot')
  cek('9. Tremolo 1 = diddle, tremolo 3 = buzz', ev('P1|2|1|1').diddle && !ev('P1|2|1|1').buzz && ev('P1|2|1|1.5').buzz && !ev('P1|2|1|1.5').diddle)
  cek('10. Tenor: Drum 1/2/3 → Tenor 1/2/3, "Spock 1" → Spock', JSON.stringify(peristiwaDalamBirama(lapisan.peristiwa, 'P2', 1).map((e) => e.alat[0])) === '["tenor1","tenor2","tenor3","spock"]')
  cek('11. Bass: akor Drum 2 + Drum 4 = satu peristiwa "Bass 2 + Bass 4"', labelAlatPeristiwa(ev('P3|1|1|0')) === 'Bass 2 + Bass 4')
  cek('12. Bass: Drum 1, Drum 5, Unison', ev('P3|1|1|1').alat[0] === 'bass1' && ev('P3|1|1|2').alat[0] === 'bass5' && ev('P3|1|1|3').alat[0] === 'bass-unison')
  cek('13. Tanpa nama instrumen: nomor Bass dari letak (tertinggi = Bass 1)', klasifikasiNotPerkusi({ peran: 'bass', letak: nilaiLetak('E', 5), letakPart: [nilaiLetak('E', 5), nilaiLetak('C', 5), nilaiLetak('A', 4)] }).alat === 'bass1' && klasifikasiNotPerkusi({ peran: 'bass', letak: nilaiLetak('A', 4), letakPart: [nilaiLetak('E', 5), nilaiLetak('C', 5), nilaiLetak('A', 4)] }).alat === 'bass3')
  cek('14. "Bass Clarinet" bernada bukan Bass Drum; "Marimba" = Pit', peranDariNamaPart('Bass Clarinet', false) === null && peranDariNamaPart('Marimba', false) === 'pit')
  cek('15. Skor timewise ditandai tidak didukung (tanpa lemparan)', uraiLapisanPerkusi('<score-timewise></score-timewise>').didukung === false)
}

console.log('== 4. Revisi lapangan ==')
let revisi = []
{
  revisi = terapkanUbahRevisi(revisi, ev('P1|1|1|0.5'), { sticking: 'R' }, 10)
  cek('16. Ganti L → R tercatat sebagai revisi', revisi.length === 1 && revisi[0].sticking === 'R' && revisi[0].idPart === 'P1' && revisi[0].birama === 1)
  const sama = terapkanUbahRevisi([], ev('P1|1|1|0'), { sticking: 'R', aksen: 1 }, 10)
  cek('17. Nilai yang sama dengan skor tidak menjadi revisi', sama.length === 0)
  revisi = terapkanUbahRevisi(revisi, ev('P1|1|1|1'), { aksen: 2, flam: 2 }, 11)
  revisi = terapkanUbahRevisi(revisi, ev('P1|2|1|1.5'), { diddle: true }, 12)
  const rBuzz = revisi.find((r) => r.kunci === 'P1|2|1|1.5')
  cek('18. Diddle menyalakan, buzz asli dimatikan (saling eksklusif)', rBuzz.diddle === true && rBuzz.buzz === false)
  revisi = terapkanUbahRevisi(revisi, ev('P3|1|1|1'), { sticking: 'L' }, 13)
  revisi = terapkanUbahRevisi(revisi, ev('P1|1|1|3.5'), { sticking: null }, 14)
  cek('19. Hapus sticking asli = `null`', revisi.find((r) => r.kunci === 'P1|1|1|3.5')?.sticking === null)
  const balik = terapkanUbahRevisi(revisi, ev('P1|1|1|3.5'), 'asli')
  cek('20. ↺ Asli membuang revisi not itu saja', balik.length === revisi.length - 1 && !balik.some((r) => r.kunci === 'P1|1|1|3.5'))
  const yatim = { kunci: 'P1|9|1|0', idPart: 'P1', birama: 9, sticking: 'L', diubah: 1 }
  const g = gabungLapisanRevisi(lapisan, [...revisi, yatim])
  cek('21. Revisi yatim (skor diganti) dihitung, bukan dipaksakan', g.yatim.length === 1 && g.yatim[0].kunci === 'P1|9|1|0')
  const efektif = peristiwaDalamBirama(g.peristiwa, 'P1', 1)
  cek('22. Lapisan efektif: R R R R L R L · dan tanda direvisi', teksStickingBirama(efektif) === 'R R R R L R L ·' && efektif[1].direvisi && !efektif[0].direvisi, teksStickingBirama(efektif))
  const rapi = rapikanDaftarRevisi([null, 3, { kunci: '' }, { kunci: 'a', idPart: 'P1' }, { kunci: 'b', idPart: 'P1', sticking: 'rLx' }, { kunci: 'c', idPart: 'P1', aksen: 7, buzz: true }, { kunci: 'c', idPart: 'P1', aksen: 1 }])
  cek('23. rapikanDaftarRevisi: buang rusak/kosong, yang terakhir menang', rapi.length === 1 && rapi[0].kunci === 'c' && rapi[0].aksen === 1, JSON.stringify(rapi))
  cek('24. saringRevisiUntukPart hanya part yang diminta', saringRevisiUntukPart(revisi, ['P3']).length === 1 && saringRevisiUntukPart(revisi, null).length === revisi.length)
}

console.log('== 5. Suntikan ke salinan XML ==')
{
  const salinanAsli = SKOR_DRUMLINE.slice()
  const hasil = sisipkanRevisiPerkusi(SKOR_DRUMLINE, lapisan, revisi)
  cek('25. Semua revisi diterapkan, berkas asli tidak berubah', hasil.diterapkan === revisi.length && hasil.yatim === 0 && SKOR_DRUMLINE === salinanAsli, `${hasil.diterapkan}/${revisi.length}`)
  cek('26. Tinta revisi memakai hex #c2410c (tanpa rgba/oklch)', WARNA_REVISI_PERKUSI === '#c2410c' && hasil.xml.includes('color="#c2410c"') && !/rgba\(|oklch\(|color-mix\(/.test(hasil.xml))
  const l2 = uraiLapisanPerkusi(hasil.xml)
  const e2 = (k) => l2.peristiwa.find((e) => e.kunci === k)
  cek('27. Kunci peristiwa stabil setelah disuntik (jumlah sama)', l2.peristiwa.length === lapisan.peristiwa.length && l2.peristiwa.every((e) => lapisan.peristiwa.some((x) => x.kunci === e.kunci)))
  cek('28. Urai ulang: L→R, sticking dihapus', e2('P1|1|1|0.5').sticking === 'R' && e2('P1|1|1|3.5').sticking === undefined)
  cek('29. Urai ulang: marcato + drag (2 not hias)', e2('P1|1|1|1').aksen === 2 && e2('P1|1|1|1').flam === 2)
  cek('30. Urai ulang: buzz → diddle', e2('P1|2|1|1.5').diddle === true && e2('P1|2|1|1.5').buzz === false)
  cek('31. Not bass tanpa sticking mendapat arah sticking baru', e2('P3|1|1|1').sticking === 'L')
  cek('32. Revisi bertahan setelah urai ulang: tidak ada yatim', gabungLapisanRevisi(l2, revisi).yatim.length === 0)
  const j = uraiJadwalNadaMusicXml(hasil.xml, ['P1'])
  const n = (b, m) => j.nada.find((x) => x.birama === b && Math.abs(x.mulaiPerempat - m) < 1e-6)
  cek('33. Suara panduan ikut revisi: drag + marcato', n(1, 1)?.flam === 2 && n(1, 1)?.aksen === 2)
  cek('34. Suara panduan ikut revisi: diddle (tremolo 1–2)', (n(2, 1.5)?.tremolo ?? 0) > 0 && (n(2, 1.5)?.tremolo ?? 0) < 3, JSON.stringify(n(2, 1.5)))
  cek('35. Ritme tidak berubah: jumlah not snare tetap 11', j.nada.length === 11, String(j.nada.length))
  const kosong = sisipkanRevisiPerkusi(SKOR_DRUMLINE, lapisan, [])
  cek('36. Tanpa revisi = teks identik', kosong.xml === SKOR_DRUMLINE && kosong.diterapkan === 0)
  cek('37. Masih lulus pemeriksa MusicXML ringkas', ringkasMusicXml(hasil.xml).ok === true)
}

console.log('== 6. Paket anggota (#13a) ==')
{
  const bita = new TextEncoder().encode(SKOR_DRUMLINE)
  const lamp = buatLampiranPartiturPaket('lagu-p', 'cadence.musicxml', 'musicxml', bita, 'hash-c')
  const r = ringkasMusicXml(SKOR_DRUMLINE)
  const anotasi = [{ id: 'lagu-p', songId: 'lagu-p', revisi, hashPartitur: 'hash-c', updatedAt: 20 }]
  const dasar = {
    format: 'drillkit-share',
    version: 1,
    exportedAt: 1700000000000,
    team: { teamName: 'MB Uji', coachName: 'Raka', defaultField: {} },
    members: [
      { id: 'm-sn', code: 'P01', name: 'Budi', section: 'battery', instrument: 'Snare Drum', role: 'member', yearJoined: 2025, active: 1, token: 't1' },
      { id: 'm-bd', code: 'P02', name: 'Sari', section: 'battery', instrument: 'Bass Drums', role: 'member', yearJoined: 2025, active: 1, token: 't2' },
      { id: 'm-tp', code: 'B01', name: 'Andi', section: 'brass', instrument: 'Trumpet in Bb', role: 'member', yearJoined: 2025, active: 1, token: 't3' },
    ],
    sessions: [],
    drills: [],
    sets: [],
    songs: [{ id: 'lagu-p', title: 'Cadence', bpm: 120, beats: 4, tempoMap: [], createdAt: 1, partitur: { namaFile: 'cadence.musicxml', tipe: 'musicxml', ukuran: bita.byteLength, hash: 'hash-c', jumlahBirama: 2, jumlahPart: 5, parts: r.ok ? r.ringkas.parts : [], terurai: true, dipasangiAt: 1 } }],
    partiturPaket: { 'lagu-p': lamp },
    anotasiPartitur: anotasi,
    attendance: [],
    memberNotes: [],
  }
  const grup = paketGrup(dasar)
  cek('38. Paket grup membawa semua revisi', grup.anotasiPartitur?.[0]?.revisi.length === revisi.length)
  const pSn = paketAnggota(dasar, 'm-sn')
  cek('39. Anggota snare: partitur P1 saja + revisi P1 saja', JSON.stringify(pSn.partiturPaket?.['lagu-p']?.partTersaring) === '["P1"]' && pSn.anotasiPartitur?.[0]?.revisi.every((x) => x.idPart === 'P1') && pSn.anotasiPartitur[0].revisi.length === revisi.length - 1, JSON.stringify(pSn.partiturPaket?.['lagu-p']?.partTersaring))
  const pBd = paketAnggota(dasar, 'm-bd')
  cek('40. Anggota bass: hanya revisi P3', pBd.anotasiPartitur?.[0]?.revisi.length === 1 && pBd.anotasiPartitur[0].revisi[0].idPart === 'P3')
  const pTp = paketAnggota(dasar, 'm-tp')
  cek('41. Anggota trumpet: tidak menerima revisi perkusi sama sekali', pTp.anotasiPartitur === undefined)
  cek('42. Id tak dikenal: tanpa revisi', paketAnggota(dasar, 'asing').anotasiPartitur === undefined)
  cek('43. Lagu PDF / tanpa lampiran tidak membawa revisi', saringAnotasiUntukPaket(anotasi, {}) === undefined && saringAnotasiUntukPaket(anotasi, { 'lagu-p': { ...lamp, tipe: 'pdf' } }) === undefined)
  const kunci = await buatKunciBaru()
  const { json } = await siapTerbitLengkap(dasar, { 'm-sn': kunci })
  const dimuat = muatBerkasTerbit(json)
  const pribadi = await bukaDataPribadi(dimuat.locked, 'm-sn', kunci)
  cek('44. Terbit: revisi ada di bagian grup, tidak digandakan di ciphertext', Boolean(dimuat.grup?.anotasiPartitur?.length) && pribadi?.anotasiPartitur === undefined)
}

console.log('== 7. Pemanasan Timing Grid ==')
{
  cek('45. Empat pemanasan tersedia', DAFTAR_PEMANASAN_PERKUSI.length === 4)
  let semuaSah = true
  for (const d of DAFTAR_PEMANASAN_PERKUSI) {
    const h = susunPemanasanPerkusi(d.id)
    if (!h || !h.latih.on || h.latih.dari >= h.latih.ke || h.latih.tiap !== h.pola.bars.length) semuaSah = false
    for (const b of h?.pola.bars ?? []) {
      if (b.cells.length !== b.beats * b.subdiv || b.sticking?.length !== b.cells.length) semuaSah = false
      if (!b.sticking.every((s) => s === 'R' || s === 'L')) semuaSah = false
    }
  }
  cek('46. Tiap kotak punya sticking R/L; latih tempo naik per putaran pola', semuaSah)
  const delapan = susunPemanasanPerkusi('delapan-satu-tangan')
  cek('47. 8 on a Hand: 8 birama not 1/8, R×8 lalu L×8', delapan.pola.bars.length === 8 && delapan.pola.bars[0].subdiv === 2 && delapan.pola.bars[0].sticking.join('') === 'RRRRRRRR' && delapan.pola.bars[1].sticking.join('') === 'LLLLLLLL')
  const aksen = susunPemanasanPerkusi('aksen-bergeser')
  const posisi = aksen.pola.bars.map((b) => b.cells.findIndex((c) => c === 2))
  cek('48. Aksen bergeser 1 → e → & → a', JSON.stringify(posisi) === '[0,1,2,3]' && aksen.pola.bars.every((b) => b.cells.filter((c) => c === 2).length === 4))
  cek('49. Triplet memakai pembagian 3', susunPemanasanPerkusi('triplet-diddle').pola.bars.every((b) => b.subdiv === 3))
  cek('50. Id tak dikenal → null', susunPemanasanPerkusi('tidak-ada') === null)
  const bar = delapan.pola.bars[2]
  const kecil = rapikanBirama({ ...bar, beats: 2 })
  const besar = rapikanBirama({ ...bar, beats: 5 })
  cek('51. rapikanBirama memangkas/menambal sticking sepanjang kotak', kecil.sticking.length === 4 && kecil.sticking.join('') === 'RRRR' && besar.sticking.length === 10 && besar.sticking[9] === '')
  const tanpa = rapikanBirama({ id: 'x', beats: 4, subdiv: 1, cells: [2, 1, 1, 1] })
  cek('52. Pola biasa tanpa sticking tetap tanpa sticking', !('sticking' in tanpa))
}

console.log(`\nRingkasan #28 Studio Perkusi: ${lulus} lulus, ${gagal.length} gagal`)
if (gagal.length) {
  console.log('Gagal:', gagal.join(' | '))
  process.exit(1)
}
