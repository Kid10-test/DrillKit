import puppeteer from 'puppeteer'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--mute-audio','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/home/user/drillkit/qa/nada-a4-440.wav'] })
const p = await b.newPage()
p.on('pageerror', e => console.log('ERR', e.message.slice(0,120)))
await p.goto('http://localhost:5173/', { waitUntil: 'networkidle2' }); await wait(1500)
const out = await p.evaluate(async () => {
  const { deteksiHz } = await import('/src/lib/tuner.ts')
  const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
  const ctx = new AudioContext()
  const src = ctx.createMediaStreamSource(s)
  const an = ctx.createAnalyser()
  an.fftSize = 2048
  src.connect(an)
  const buf = new Float32Array(an.fftSize)
  const hasil = []
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 100))
    an.getFloatTimeDomainData(buf)
    let energi = 0, min = 9, max = -9
    for (const v of buf) { energi += v*v; if (v<min) min=v; if (v>max) max=v }
    hasil.push({ hz: deteksiHz(buf, ctx.sampleRate), rms: +Math.sqrt(energi/buf.length).toFixed(4), min: +min.toFixed(3), max: +max.toFixed(3) })
  }
  return { sr: ctx.sampleRate, hasil }
})
console.log('sampleRate', out.sr)
console.log(JSON.stringify(out.hasil.map(h => `${h.hz ? h.hz.toFixed(1) : 'null'} Hz rms=${h.rms} [${h.min},${h.max}]`), null, 0).replace(/","/g,'"\n"'))
await b.close()
