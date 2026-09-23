import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
for (const [nama, url] of [['produksi (http)', 'http://localhost:4173/'], ['portabel (file://)', 'file:///home/user/drillkit/portable/DrillKit.html']]) {
  const b = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--allow-file-access-from-files', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  })
  const p = await b.newPage()
  await p.goto(url, { waitUntil: 'domcontentloaded' }); await wait(1800)
  const hasil = await p.evaluate(async () => {
    const out = { konteksAman: window.isSecureContext, adaAudio: typeof (window.AudioContext || window.webkitAudioContext) === 'function', adaMediaRecorder: typeof window.MediaRecorder === 'function' }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      out.mik = 'BISA (' + s.getAudioTracks().length + ' track)'
      s.getTracks().forEach((t) => t.stop())
    } catch (e) { out.mik = 'DITOLAK: ' + String(e.name || e.message).slice(0, 60) }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const an = ctx.createAnalyser()
      out.analyser = an ? 'bisa' : 'tidak'
      out.sampleRate = ctx.sampleRate
      await ctx.close()
    } catch (e) { out.analyser = 'gagal: ' + String(e.message).slice(0, 40) }
    return out
  })
  console.log(nama, JSON.stringify(hasil))
  await b.close()
}
