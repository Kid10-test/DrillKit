/**
 * #13 (Uji Logika Node) — Partitur Tersaring Per-Suara di Paket Anggota,
 * Pengurai & Penjadwal Bunyi Notasi WebAudio, serta Harmoni/Temperamen Drone Penala.
 *
 * Menguji modul murni hasil rakitan `qa/bangun-logika.sh`:
 *   - `/tmp/partiturPaket.mjs` + `/tmp/bagikan.mjs` + `/tmp/terbit.mjs` + `/tmp/bukaBerkas.mjs`
 *   - `/tmp/partiturBunyi.mjs` + `/tmp/partitur.mjs`
 *   - `/tmp/tuner.mjs`
 */
import {
  bitaDariLampiranPartiturPaket,
  bitaKeBase64,
  base64KeBita,
  buatLampiranPartiturPaket,
  pangkasMusicXmlKePart,
} from '/tmp/partiturPaket.mjs'
import { paketAnggota, paketGrup } from '/tmp/bagikan.mjs'
import { siapTerbitLengkap, muatBerkasTerbit, bukaDataPribadi } from '/tmp/terbit.mjs'
import { buatKunciBaru } from '/tmp/kunci.mjs'
import { ringkasPaket } from '/tmp/bukaBerkas.mjs'
import { ringkasMusicXml } from '/tmp/partitur.mjs'
import {
  cariPosisiBiramaDariDetik,
  jadwalkanDetikNada,
  midiKeHz,
  uraiJadwalNadaMusicXml,
} from '/tmp/partiturBunyi.mjs'
import {
  panduanAkorDengung,
  susunKomponenHarmoniDengung,
} from '/tmp/tuner.mjs'

let lulus = 0
let gagal = 0

function cek(nama, kondisi, detail = '') {
  if (kondisi) {
    lulus += 1
    console.log(`  ✓ ${nama}`)
  } else {
    gagal += 1
    console.error(`  ✗ GAGAL: ${nama}${detail ? ` — ${detail}` : ''}`)
  }
}

const SKOR_EMPAT_PART = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <work><work-title>Mars Nusantara</work-title></work>
  <part-list>
    <part-group type="start" number="1"><group-symbol>bracket</group-symbol></part-group>
    <score-part id="P1"><part-name>Flute</part-name></score-part>
    <score-part id="P2"><part-name>Trumpet in Bb 1</part-name></score-part>
    <score-part id="P3"><part-name>Trumpet in Bb 2</part-name></score-part>
    <part-group type="stop" number="1"/>
    <score-part id="P4"><part-name>Snare Drum</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <direction placement="above">
        <direction-type><rehearsal>A</rehearsal></direction-type>
        <sound tempo="120"/>
      </direction>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>8</duration><type>whole</type></note>
    </measure>
    <measure number="2">
      <direction placement="above">
        <direction-type><rehearsal>B</rehearsal></direction-type>
      </direction>
      <note><rest/><duration>8</duration></note>
    </measure>
  </part>
  <part id="P2">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose>
      </attributes>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>6</duration><type>half</type><dot/></note>
      <note>
        <pitch><step>D</step><octave>5</octave></pitch><duration>2</duration><tie type="start"/>
      </note>
    </measure>
    <measure number="2">
      <note>
        <pitch><step>D</step><octave>5</octave></pitch><duration>4</duration><tie type="stop"/>
      </note>
      <note>
        <pitch><step>E</step><octave>5</octave></pitch><duration>4</duration>
      </note>
      <note>
        <chord/>
        <pitch><step>G</step><octave>5</octave></pitch><duration>4</duration>
      </note>
    </measure>
  </part>
  <part id="P3">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <transpose><chromatic>-2</chromatic></transpose>
      </attributes>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>8</duration></note>
    </measure>
    <measure number="2">
      <note><pitch><step>B</step><octave>4</octave></pitch><duration>8</duration></note>
    </measure>
  </part>
  <part id="P4">
    <measure number="1">
      <attributes>
        <divisions>2</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note><unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>2</duration></note>
      <note><unpitched><display-step>F</display-step><display-octave>4</display-octave></unpitched><duration>2</duration></note>
      <note><unpitched><display-step>A</display-step><display-octave>5</display-octave></unpitched><duration>4</duration></note>
    </measure>
    <measure number="2">
      <note><rest/><duration>8</duration></note>
    </measure>
  </part>
</score-partwise>`

console.log('== #13a: Pemangkasan MusicXML & Paket Per-Suara ==')
{
  const pangkasTrp = pangkasMusicXmlKePart(SKOR_EMPAT_PART, ['P2'])
  cek('1. P1, P3, P4 terbuang dari skor hasil pangkas P2', !pangkasTrp.includes('id="P1"') && !pangkasTrp.includes('id="P3"') && !pangkasTrp.includes('id="P4"'))
  cek('2. P2 tetap utuh di part-list & part', pangkasTrp.includes('<score-part id="P2">') && pangkasTrp.includes('<part id="P2">'))
  cek('3. Tag <part-group> menggantung dibersihkan dari part-list', !/<part-group\b/i.test(pangkasTrp))
  cek('4. Huruf latihan <rehearsal>A</rehearsal> & B diwariskan dari P1 ke P2', pangkasTrp.includes('<rehearsal>A</rehearsal>') && pangkasTrp.includes('<rehearsal>B</rehearsal>'))
  cek('5. Tanda <sound tempo="120"/> diwariskan dari P1 ke P2', /tempo="120"/.test(pangkasTrp))
  cek('6. Ukuran XML terpangkas jauh lebih kecil dari skor 4-part', pangkasTrp.length < SKOR_EMPAT_PART.length * 0.65, `${pangkasTrp.length} vs ${SKOR_EMPAT_PART.length}`)

  const ringkas = ringkasMusicXml(pangkasTrp)
  cek('7. Skor hasil pangkas tetap valid diurai ringkasMusicXml (#11a)', ringkas.ok && ringkas.ringkas.jumlahPart === 1 && ringkas.ringkas.jumlahBirama === 2)

  // Jatuh aman bila id tidak dikenal atau semua part diminta
  cek('8. Jatuh aman untuk id asing (mengembalikan XML asli)', pangkasMusicXmlKePart(SKOR_EMPAT_PART, ['P99']) === SKOR_EMPAT_PART)
  cek('9. Jatuh aman untuk semua part', pangkasMusicXmlKePart(SKOR_EMPAT_PART, ['P1', 'P2', 'P3', 'P4']) === SKOR_EMPAT_PART)

  // Roundtrip PDF biner via Base64
  const pdfContoh = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0xff, 0x00, 0x7f])
  const b64 = bitaKeBase64(pdfContoh)
  const balik = base64KeBita(b64)
  cek('10. Roundtrip bitaKeBase64 ↔ base64KeBita identik per-bita', balik.length === pdfContoh.length && balik.every((v, i) => v === pdfContoh[i]))

  // Paket berbagi grup vs per anggota
  const bitaSkor = new TextEncoder().encode(SKOR_EMPAT_PART)
  const lampiranPenuh = buatLampiranPartiturPaket('lagu-1', 'mars.musicxml', 'musicxml', bitaSkor, 'hash-utuh')
  const rUtuh = ringkasMusicXml(SKOR_EMPAT_PART)

  const dasarBundle = {
    format: 'drillkit-share',
    version: 1,
    exportedAt: 1700000000000,
    team: { teamName: 'MB Gita Bahana', coachName: 'Raka', defaultField: {} },
    members: [
      { id: 'm-trp1', code: 'B01', name: 'Andi Pratama', section: 'brass', instrument: 'Trumpet 1', role: 'member', yearJoined: 2025, active: 1, token: 'rahasia-1', phone: '08111', notes: 'catatan rahasia' },
      { id: 'm-snare', code: 'P01', name: 'Budi Santoso', section: 'battery', instrument: 'Snare Drum', role: 'member', yearJoined: 2025, active: 1, token: 'rahasia-2' },
      { id: 'm-marimba', code: 'T01', name: 'Citra Dewi', section: 'pit', instrument: 'Marimba', role: 'member', yearJoined: 2025, active: 1, token: 'rahasia-3' },
    ],
    sessions: [],
    drills: [],
    sets: [],
    songs: [
      {
        id: 'lagu-1',
        title: 'Mars Nusantara',
        bpm: 120,
        beats: 4,
        tempoMap: [],
        createdAt: 1,
        partitur: {
          namaFile: 'mars.musicxml',
          tipe: 'musicxml',
          ukuran: bitaSkor.byteLength,
          hash: 'hash-utuh',
          jumlahBirama: 2,
          jumlahPart: 4,
          parts: rUtuh.ok ? rUtuh.ringkas.parts : [],
          terurai: true,
          dipasangiAt: 1,
        },
      },
    ],
    partiturPaket: { 'lagu-1': lampiranPenuh },
    attendance: [{ id: 'a1', sessionId: 's1', memberId: 'm-trp1', status: 'hadir' }],
    memberNotes: [{ id: 'n1', memberId: 'm-trp1', at: 1, text: 'Jaga napas' }],
  }

  const grup = paketGrup(dasarBundle)
  cek('11. paketGrup mempertahankan skor penuh 4 part', grup.partiturPaket?.['lagu-1']?.xml === SKOR_EMPAT_PART && grup.songs[0].partitur.jumlahPart === 4)
  cek('12. ringkasPaket menghitung jumlahPartitur = 1', ringkasPaket(grup)?.jumlahPartitur === 1)

  const pktAndi = paketAnggota(dasarBundle, 'm-trp1')
  cek('13. paketAnggota Trumpet 1 menyaring hanya P2 (Trumpet in Bb 1)', JSON.stringify(pktAndi.partiturPaket?.['lagu-1']?.partTersaring) === JSON.stringify(['P2']), JSON.stringify(pktAndi.partiturPaket?.['lagu-1']?.partTersaring))
  cek('14. Metadata song.partitur di paket Andi ikut diselaraskan ke 1 part', pktAndi.songs[0].partitur.jumlahPart === 1 && pktAndi.songs[0].partitur.parts[0].id === 'P2')
  cek('15. Privasi anggota tetap terjaga di paket per anggota', pktAndi.members.every((m) => m.token === '' && !m.phone && !m.notes))

  const pktBudi = paketAnggota(dasarBundle, 'm-snare')
  cek('16. paketAnggota Snare menyaring hanya P4 (Snare Drum)', JSON.stringify(pktBudi.partiturPaket?.['lagu-1']?.partTersaring) === JSON.stringify(['P4']))

  const pktCitra = paketAnggota(dasarBundle, 'm-marimba')
  cek('17. paketAnggota Marimba (tidak ada di skor) jatuh aman ke skor penuh tanpa jalan buntu', pktCitra.partiturPaket?.['lagu-1']?.xml === SKOR_EMPAT_PART && pktCitra.partiturPaket?.['lagu-1']?.partTersaring === undefined)

  const pktAsing = paketAnggota(dasarBundle, 'id-tidak-dikenal')
  cek('18. paketAnggota id tak dikenal tidak membocorkan lampiran maupun data pribadi', pktAsing.partiturPaket === undefined && pktAsing.attendance.length === 0 && pktAsing.memberNotes.length === 0)

  // Terbitkan ke GitHub (`siapTerbitLengkap`) tidak menduplikasi XML partitur ke dalam ciphertext `locked`
  const kunciAndi = await buatKunciBaru()
  const { json: jsonTerbit } = await siapTerbitLengkap(dasarBundle, { 'm-trp1': kunciAndi })
  const dimuat = muatBerkasTerbit(jsonTerbit)
  const pribadiAndi = await bukaDataPribadi(dimuat.locked, 'm-trp1', kunciAndi)
  cek('19. Berkas terbit memuat partiturPaket sekali di bagian grup terbuka', Boolean(dimuat?.grup?.partiturPaket?.['lagu-1']?.xml))
  cek('20. Ciphertext locked tidak menduplikasi partiturPaket', pribadiAndi?.partiturPaket === undefined && pribadiAndi?.attendance?.length === 1)

  const bitaKembali = bitaDariLampiranPartiturPaket(pktAndi.partiturPaket['lagu-1'])
  cek('21. bitaDariLampiranPartiturPaket menghasilkan bita UTF-8 siap masuk IndexedDB', bitaKembali instanceof Uint8Array && bitaKembali.byteLength > 100)
}

console.log('\n== #13b: Pengurai & Penjadwal Bunyi Notasi WebAudio ==')
{
  const jadwalTrp = uraiJadwalNadaMusicXml(SKOR_EMPAT_PART, ['P2'])
  cek('22. uraiJadwalNadaMusicXml(P2) hanya memuat part P2 dengan 2 birama', jadwalTrp.jumlahBirama === 2 && JSON.stringify(jadwalTrp.idPartTermuat) === '["P2"]')
  // P2 di birama 1: C5 tertulis (MIDI 72) + chromatic -2 -> Bb4 konser (MIDI 70), durasi 3 ketuk;
  // lalu D5 tertulis (MIDI 74) -> C5 konser (MIDI 72) durasi 1 ketuk disambung tie ke birama 2 (2 ketuk) = total 3 ketuk!
  // lalu di birama 2 ketuk ke-3 (mulaiPerempat = 2): akor E5+G5 tertulis -> D5 (74) + F5 (77) konser serempak!
  cek('23. Tie lintas birama digabung menjadi satu not bersambung (4 peristiwa nada di P2, bukan 5)', jadwalTrp.nada.length === 4, `jumlah=${jadwalTrp.nada.length}`)
  cek('24. Transposisi Bb (-2 semiton): C5 tertulis dimainkan sebagai Bb4 konser (MIDI 70)', jadwalTrp.nada[0]?.midiKonser === 70 && jadwalTrp.nada[0]?.durasiPerempat === 3)
  cek('25. Not bertali (tie) D5 tertulis memiliki durasi gabungan 3 ketuk seperempat (1 + 2)', jadwalTrp.nada[1]?.midiKonser === 72 && Math.abs(jadwalTrp.nada[1]?.durasiPerempat - 3) < 1e-6)
  cek('26. Tag <chord/> memainkan dua nada akor serempak pada mulaiPerempat = 2', jadwalTrp.nada[2]?.mulaiPerempat === 2 && jadwalTrp.nada[3]?.mulaiPerempat === 2 && jadwalTrp.nada[2]?.midiKonser === 74 && jadwalTrp.nada[3]?.midiKonser === 77)

  const jadwalSnare = uraiJadwalNadaMusicXml(SKOR_EMPAT_PART, ['P4'])
  cek('27. Part perkusi <unpitched> terurai sebagai jenis perkusi (sedang, rendah, tinggi)', jadwalSnare.nada.length === 3 && jadwalSnare.nada[0]?.jenis === 'perkusi' && jadwalSnare.nada[0]?.warnaPerkusi === 'sedang' && jadwalSnare.nada[1]?.warnaPerkusi === 'rendah' && jadwalSnare.nada[2]?.warnaPerkusi === 'tinggi')

  // Penjadwalan detik pada 120 BPM (1 ketuk = 0.5 detik) vs tempo latihan 50% (1 ketuk = 1.0 detik)
  const detik100 = jadwalkanDetikNada(jadwalTrp, { tempoDasar: 120, persenTempo: 100 })
  const detik50 = jadwalkanDetikNada(jadwalTrp, { tempoDasar: 120, persenTempo: 50 })
  cek('28. Durasi 2 birama 4/4 @ 120 BPM = 4,0 detik; pada tempo latihan 50% = 8,0 detik', Math.abs(detik100.totalDurasiDetik - 4) < 1e-6 && Math.abs(detik50.totalDurasiDetik - 8) < 1e-6)
  cek('29. Frekuensi konser Bb4 tepat ~466,16 Hz pada A4=440', Math.abs((detik100.peristiwa[0]?.frekuensiHz ?? 0) - midiKeHz(70, 440)) < 0.01)

  // Rentang frasa (hanya birama 2) + peta segmen tempo
  const detikFrasa = jadwalkanDetikNada(jadwalTrp, {
    tempoMap: [{ id: 'seg1', label: 'Intro', measure: 1, bpm: 60, beats: 4 }],
    dariBirama: 2,
    sampaiBirama: 2,
  })
  cek('30. Penjadwalan frasa birama 2..2 @ 60 BPM mulai dari t=0 berdurasi 4,0 detik', detikFrasa.biramaWaktu.length === 1 && detikFrasa.biramaWaktu[0].birama === 2 && Math.abs(detikFrasa.totalDurasiDetik - 4) < 1e-6)
  const pos = cariPosisiBiramaDariDetik(detikFrasa.biramaWaktu, 2.5)
  cek('31. cariPosisiBiramaDariDetik memetakan t=2,5s pada 60 BPM ke Birama 2 Ketuk indeks 2 (ketuk ke-3)', pos.birama === 2 && pos.ketuk === 2)
}

console.log('\n== #13c: Harmoni & Temperamen Murni (Just) vs 12-TET pada Drone Penala ==')
{
  const mayorMurni = susunKomponenHarmoniDengung('mayor', 'murni')
  const mayorSetara = susunKomponenHarmoniDengung('mayor', 'setara')
  const minorMurni = susunKomponenHarmoniDengung('minor', 'murni')

  cek('32. Akor Mayor Murni memakai rasio utuh 1 : 5/4 (1.25, -14 sen) : 3/2 (1.5, +2 sen)', mayorMurni.length === 3 && mayorMurni[1].rasio === 1.25 && mayorMurni[1].koreksiSen === -14 && mayorMurni[2].rasio === 1.5 && mayorMurni[2].koreksiSen === 2)
  cek('33. Akor Mayor 12-TET memakai rasio 2^(4/12) & 2^(7/12) dengan koreksi 0 sen', Math.abs(mayorSetara[1].rasio - Math.pow(2, 4 / 12)) < 1e-9 && mayorSetara.every((k) => k.koreksiSen === 0))
  cek('34. Akor Minor Murni memakai terts kecil 6/5 (1.2, +16 sen)', minorMurni[1].rasio === 1.2 && minorMurni[1].koreksiSen === 16)

  // Bb3 konser (A#3) untuk instrumen Trumpet Bb (geser +2 semiton) -> C4, E4 (-14 sen), G4 (+2 sen)
  const panduanTrp = panduanAkorDengung('A#', 3, 2, 'mayor', 'murni')
  cek(
    '35. Panduan akor Bb3 Mayor untuk partitur Trumpet Bb menghasilkan C4 · E4 (-14 sen) · G4 (+2 sen)',
    panduanTrp[0].tertulis === 'C4' &&
      panduanTrp[1].tertulis === 'E4' &&
      panduanTrp[1].koreksiSen === -14 &&
      panduanTrp[2].tertulis === 'G4' &&
      panduanTrp[2].koreksiSen === 2,
    JSON.stringify(panduanTrp),
  )
}

console.log(`\nRingkasan #13 Logika: ${lulus} lulus, ${gagal} gagal`)
if (gagal > 0) process.exit(1)
