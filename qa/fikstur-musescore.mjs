/**
 * #27 — Fikstur MuseScore sintetis untuk `mscz-logika.mjs` & `mscz-e2e.mjs`.
 *
 * **Clean-room:** kedua berkas di bawah disusun tangan dari pengamatan format
 * `.mscx` (MuseScore 3 & 4) — bukan salinan berkas uji MuseScore (GPL-3.0).
 *
 * MS4 "Mars Uji Lapangan": Trumpet B♭ + Snare Line (drumset), 6 birama —
 * pickup ¼, ‖: A :‖, 6/8 ♩.=80 di B, rit. → Maestoso ♩.=60, triol & sticking.
 * MS3 "Lagu Tiga": Flute 3/4 ♩=90, tie & triol ber-id.
 */
export const MS4 = `<?xml version="1.0" encoding="UTF-8"?>
<museScore version="4.20">
  <programVersion>4.2.0</programVersion>
  <Score>
    <Division>480</Division>
    <metaTag name="workTitle">Mars Uji Lapangan</metaTag>
    <Part id="1">
      <Staff id="1"><StaffType group="pitched"><name>stdNormal</name></StaffType></Staff>
      <trackName>Trumpet in B♭</trackName>
      <Instrument id="bb-trumpet">
        <longName>Trumpet in B♭</longName>
        <shortName>Tpt.</shortName>
        <trackName>Trumpet in B♭</trackName>
        <transposeDiatonic>-1</transposeDiatonic>
        <transposeChromatic>-2</transposeChromatic>
        <Channel><program value="56"/></Channel>
      </Instrument>
    </Part>
    <Part id="2">
      <Staff id="2"><StaffType group="percussion"><name>perc5Line</name></StaffType></Staff>
      <trackName>Snare Line</trackName>
      <Instrument id="marching-snare">
        <longName>Snare Line</longName>
        <trackName>Snare Line</trackName>
        <useDrumset>1</useDrumset>
        <Drum pitch="38"><head>normal</head><line>3</line><name>Snare</name></Drum>
        <Drum pitch="37"><head>cross</head><line>3</line><name>Rim</name></Drum>
        <Channel><program value="0"/></Channel>
      </Instrument>
    </Part>
    <Staff id="1">
      <Measure len="1/4">
        <voice>
          <KeySig><concertKey>-2</concertKey></KeySig>
          <TimeSig><sigN>4</sigN><sigD>4</sigD></TimeSig>
          <Tempo><tempo>2</tempo><followText>1</followText><text><sym>metNoteQuarterUp</sym> = 120</text></Tempo>
          <Chord><durationType>quarter</durationType><Note><pitch>70</pitch><tpc>12</tpc><tpc2>14</tpc2></Note></Chord>
        </voice>
      </Measure>
      <Measure>
        <startRepeat/>
        <voice>
          <RehearsalMark><text>A</text></RehearsalMark>
          <Chord><durationType>half</durationType><Note><pitch>72</pitch><tpc>14</tpc><tpc2>16</tpc2></Note></Chord>
          <Chord><durationType>half</durationType><Note><pitch>74</pitch><tpc>16</tpc><tpc2>18</tpc2></Note></Chord>
        </voice>
      </Measure>
      <Measure>
        <endRepeat>2</endRepeat>
        <voice>
          <Rest><durationType>measure</durationType><duration>4/4</duration></Rest>
        </voice>
      </Measure>
      <Measure>
        <voice>
          <TimeSig><sigN>6</sigN><sigD>8</sigD></TimeSig>
          <Tempo><tempo>2</tempo><followText>1</followText><text><sym>metNoteQuarterUp</sym><sym>metAugmentationDot</sym> = 80</text></Tempo>
          <RehearsalMark><text>B</text></RehearsalMark>
          <Chord><dots>1</dots><durationType>quarter</durationType><Note><pitch>70</pitch><tpc>12</tpc><tpc2>14</tpc2></Note></Chord>
          <Chord><dots>1</dots><durationType>quarter</durationType><Note><pitch>70</pitch><tpc>12</tpc><tpc2>14</tpc2></Note></Chord>
        </voice>
      </Measure>
      <Measure>
        <voice>
          <Spanner type="GradualTempoChange">
            <GradualTempoChange><tempoChangeType>rallentando</tempoChangeType><beginText>rit.</beginText></GradualTempoChange>
            <next><location><measures>1</measures></location></next>
          </Spanner>
          <Rest><durationType>measure</durationType><duration>6/8</duration></Rest>
        </voice>
      </Measure>
      <Measure>
        <voice>
          <Spanner type="GradualTempoChange"><prev><location><measures>-1</measures></location></prev></Spanner>
          <Tempo><tempo>1.5</tempo><followText>1</followText><text>Maestoso <sym>metNoteQuarterUp</sym><sym>metAugmentationDot</sym> = 60</text></Tempo>
          <Chord><dots>1</dots><durationType>half</durationType><Note><pitch>65</pitch><tpc>13</tpc><tpc2>15</tpc2></Note></Chord>
          <BarLine><subtype>end</subtype></BarLine>
        </voice>
      </Measure>
    </Staff>
    <Staff id="2">
      <Measure len="1/4">
        <voice>
          <TimeSig><sigN>4</sigN><sigD>4</sigD></TimeSig>
          <Rest><durationType>quarter</durationType></Rest>
        </voice>
      </Measure>
      <Measure>
        <startRepeat/>
        <voice>
          <Sticking><text>R</text></Sticking>
          <Chord><durationType>quarter</durationType><Note><pitch>38</pitch><tpc>16</tpc></Note></Chord>
          <Sticking><text>L</text></Sticking>
          <Chord><durationType>quarter</durationType><Note><pitch>38</pitch><tpc>16</tpc></Note></Chord>
          <Tuplet><normalNotes>2</normalNotes><actualNotes>3</actualNotes><baseNote>eighth</baseNote></Tuplet>
          <Chord><durationType>eighth</durationType><Note><pitch>38</pitch><tpc>16</tpc></Note></Chord>
          <Chord><durationType>eighth</durationType><Note><pitch>37</pitch><tpc>15</tpc></Note></Chord>
          <Chord><durationType>eighth</durationType><Note><pitch>38</pitch><tpc>16</tpc></Note></Chord>
          <endTuplet/>
          <Chord><durationType>quarter</durationType><Note><pitch>38</pitch><tpc>16</tpc></Note></Chord>
        </voice>
      </Measure>
      <Measure>
        <endRepeat>2</endRepeat>
        <voice><Rest><durationType>measure</durationType><duration>4/4</duration></Rest></voice>
      </Measure>
      <Measure>
        <voice>
          <TimeSig><sigN>6</sigN><sigD>8</sigD></TimeSig>
          <Rest><durationType>measure</durationType><duration>6/8</duration></Rest>
        </voice>
      </Measure>
      <Measure><voice><Rest><durationType>measure</durationType><duration>6/8</duration></Rest></voice></Measure>
      <Measure><voice><Rest><durationType>measure</durationType><duration>6/8</duration></Rest></voice></Measure>
    </Staff>
  </Score>
</museScore>
`

export const MS3 = `<?xml version="1.0" encoding="UTF-8"?>
<museScore version="3.02">
  <programVersion>3.6.2</programVersion>
  <Score>
    <Division>480</Division>
    <metaTag name="workTitle">Lagu Tiga</metaTag>
    <Part>
      <Staff id="1"><StaffType group="pitched"><name>stdNormal</name></StaffType></Staff>
      <trackName>Flute</trackName>
      <Instrument><longName>Flute</longName><trackName>Flute</trackName><Channel><program value="73"/></Channel></Instrument>
    </Part>
    <Staff id="1">
      <Measure>
        <voice>
          <KeySig><accidental>1</accidental></KeySig>
          <TimeSig><sigN>3</sigN><sigD>4</sigD></TimeSig>
          <Tempo><tempo>1.5</tempo><followText>1</followText><text>Andante <sym>metNoteQuarterUp</sym> = 90</text></Tempo>
          <Chord><durationType>quarter</durationType><Note><Tie id="1"/><pitch>79</pitch><tpc>15</tpc></Note></Chord>
          <Chord><durationType>half</durationType><Note><endSpanner id="1"/><pitch>79</pitch><tpc>15</tpc></Note></Chord>
        </voice>
      </Measure>
      <Measure>
        <voice>
          <Tuplet id="1"><normalNotes>2</normalNotes><actualNotes>3</actualNotes><baseNote>quarter</baseNote></Tuplet>
          <Chord><Tuplet>1</Tuplet><durationType>quarter</durationType><Note><pitch>78</pitch><tpc>20</tpc></Note></Chord>
          <Chord><Tuplet>1</Tuplet><durationType>quarter</durationType><Note><pitch>76</pitch><tpc>18</tpc></Note></Chord>
          <Chord><Tuplet>1</Tuplet><durationType>quarter</durationType><Note><pitch>74</pitch><tpc>16</tpc></Note></Chord>
          <Chord><durationType>quarter</durationType><Note><pitch>72</pitch><tpc>14</tpc></Note></Chord>
        </voice>
      </Measure>
    </Staff>
  </Score>
</museScore>
`
