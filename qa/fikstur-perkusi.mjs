/**
 * #28 — Fikstur MusicXML drumline untuk uji Studio Perkusi.
 *
 * Disusun tangan (clean-room) dari spesifikasi MusicXML 4.0 & konvensi umum
 * partitur marching. Tidak ada berkas uji MuseScore/Finale yang disalin.
 *
 * Isi (4/4, divisions 2 = not 1/8 berdurasi 1):
 *   P1 "Snare Drum"  — B1: 8 not 1/8, sticking `<words>` gaya MuseScore
 *                      R L R R L R L L; not 1 beraksen; not 4 flam; not 6 rimshot.
 *                      B2: sticking lirik gaya Finale/Sibelius; not 2 diddle,
 *                      not 3 buzz; istirahat setengah.
 *   P2 "Tenor Drums" — B1: Drum 1, Drum 2, Drum 3, Spock 1 (sticking `<fingering>`).
 *                      B2: satu not utuh tanpa sticking.
 *   P3 "Bass Drums"  — B1: akor Drum 2 + Drum 4, Drum 1, Drum 5, Unison. B2 utuh.
 *   P4 "Marimba"     — part Pit bernada, sticking R/L `<words>`.
 *   P5 "Trumpet in Bb" — bukan perkusi (harus dilewati studio).
 */

const N = (isi) => `<note>${isi}</note>`
const kepalaSnare = '<unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched>'
const words = (t) =>
  `<direction placement="below"><direction-type><words default-y="-80">${t}</words></direction-type></direction>`

const atributPerkusi = (beats = 4) =>
  `<attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>${beats}</beats><beat-type>4</beat-type></time><clef><sign>percussion</sign><line>2</line></clef></attributes>`

const snareB1 = [
  words('R') +
    N(`${kepalaSnare}<duration>1</duration><instrument id="P1-I1"/><voice>1</voice><type>eighth</type><stem>up</stem><notations><articulations><accent/></articulations></notations>`),
  words('L') + N(`${kepalaSnare}<duration>1</duration><instrument id="P1-I1"/><voice>1</voice><type>eighth</type>`),
  words('R') + N(`${kepalaSnare}<duration>1</duration><instrument id="P1-I1"/><voice>1</voice><type>eighth</type>`),
  words('R') +
    N(`<grace slash="yes"/>${kepalaSnare}<instrument id="P1-I1"/><voice>1</voice><type>eighth</type>`) +
    N(`${kepalaSnare}<duration>1</duration><instrument id="P1-I1"/><voice>1</voice><type>eighth</type>`),
  words('L') + N(`${kepalaSnare}<duration>1</duration><instrument id="P1-I1"/><voice>1</voice><type>eighth</type>`),
  words('R') +
    N(`${kepalaSnare}<duration>1</duration><instrument id="P1-I2"/><voice>1</voice><type>eighth</type><notehead>circle-x</notehead>`),
  words('L') + N(`${kepalaSnare}<duration>1</duration><instrument id="P1-I1"/><voice>1</voice><type>eighth</type>`),
  words('L') + N(`${kepalaSnare}<duration>1</duration><instrument id="P1-I1"/><voice>1</voice><type>eighth</type>`),
].join('')

const lirik = (t) => `<lyric number="1" name="verse"><syllabic>single</syllabic><text>${t}</text></lyric>`
const snareB2 = [
  N(`${kepalaSnare}<duration>2</duration><instrument id="P1-I1"/><voice>1</voice><type>quarter</type>${lirik('R')}`),
  N(`${kepalaSnare}<duration>1</duration><instrument id="P1-I1"/><voice>1</voice><type>eighth</type><notations><ornaments><tremolo type="single">1</tremolo></ornaments></notations>${lirik('L')}`),
  N(`${kepalaSnare}<duration>1</duration><instrument id="P1-I1"/><voice>1</voice><type>eighth</type><notations><ornaments><tremolo type="single">3</tremolo></ornaments></notations>${lirik('R')}`),
  N(`<rest/><duration>4</duration><voice>1</voice><type>half</type>`),
].join('')

const ten = (step, oct, ins, fing) =>
  N(
    `<unpitched><display-step>${step}</display-step><display-octave>${oct}</display-octave></unpitched><duration>2</duration><instrument id="${ins}"/><voice>1</voice><type>quarter</type>` +
      (fing ? `<notations><technical><fingering>${fing}</fingering></technical></notations>` : ''),
  )
const tenorB1 = ten('E', 5, 'P2-I1', 'R') + ten('C', 5, 'P2-I2', 'L') + ten('A', 4, 'P2-I3', 'R') + ten('G', 5, 'P2-I5', 'L')
const tenorB2 = N(
  `<unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>8</duration><instrument id="P2-I2"/><voice>1</voice><type>whole</type>`,
)

const bas = (step, oct, ins, chord = false, kepala = '') =>
  N(
    `${chord ? '<chord/>' : ''}<unpitched><display-step>${step}</display-step><display-octave>${oct}</display-octave></unpitched><duration>2</duration><instrument id="${ins}"/><voice>1</voice><type>quarter</type>${kepala ? `<notehead>${kepala}</notehead>` : ''}`,
  )
const bassB1 = bas('D', 5, 'P3-I2') + bas('A', 4, 'P3-I4', true) + bas('E', 5, 'P3-I1') + bas('F', 4, 'P3-I5') + bas('B', 4, 'P3-I6', false, 'slash')
const bassB2 = N(
  `<unpitched><display-step>C</display-step><display-octave>5</display-octave></unpitched><duration>8</duration><instrument id="P3-I3"/><voice>1</voice><type>whole</type>`,
)

const mar = (step, st) =>
  words(st) +
  N(`<pitch><step>${step}</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type>`)
const marB1 = mar('C', 'R') + mar('E', 'L') + mar('G', 'R') + mar('C', 'L')
const marB2 = N('<pitch><step>C</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><type>whole</type>')

const tpB = N('<pitch><step>D</step><octave>5</octave></pitch><duration>8</duration><voice>1</voice><type>whole</type>')

const instr = (id, nama) => `<score-instrument id="${id}"><instrument-name>${nama}</instrument-name></score-instrument>`

export const SKOR_DRUMLINE = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Cadence Uji Studio</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Snare Drum</part-name>${instr('P1-I1', 'Snare')}${instr('P1-I2', 'Rim Shot')}</score-part>
    <score-part id="P2"><part-name>Tenor Drums</part-name>${instr('P2-I1', 'Drum 1')}${instr('P2-I2', 'Drum 2')}${instr('P2-I3', 'Drum 3')}${instr('P2-I4', 'Drum 4')}${instr('P2-I5', 'Spock 1')}</score-part>
    <score-part id="P3"><part-name>Bass Drums</part-name>${instr('P3-I1', 'Drum 1')}${instr('P3-I2', 'Drum 2')}${instr('P3-I3', 'Drum 3')}${instr('P3-I4', 'Drum 4')}${instr('P3-I5', 'Drum 5')}${instr('P3-I6', 'Unison')}</score-part>
    <score-part id="P4"><part-name>Marimba</part-name></score-part>
    <score-part id="P5"><part-name>Trumpet in Bb</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">${atributPerkusi()}<direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>120</per-minute></metronome></direction-type><sound tempo="120"/></direction>${snareB1}</measure>
    <measure number="2">${snareB2}</measure>
  </part>
  <part id="P2">
    <measure number="1">${atributPerkusi()}${tenorB1}</measure>
    <measure number="2">${tenorB2}</measure>
  </part>
  <part id="P3">
    <measure number="1">${atributPerkusi()}${bassB1}</measure>
    <measure number="2">${bassB2}</measure>
  </part>
  <part id="P4">
    <measure number="1"><attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>${marB1}</measure>
    <measure number="2">${marB2}</measure>
  </part>
  <part id="P5">
    <measure number="1"><attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>${tpB}</measure>
    <measure number="2">${tpB}</measure>
  </part>
</score-partwise>
`
