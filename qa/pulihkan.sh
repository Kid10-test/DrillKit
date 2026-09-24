#!/usr/bin/env bash
# Pulihkan lingkungan uji setelah snapshot giliran.
#
# Snapshot workspace **mengecualikan** `node_modules` dan `.cache`. Akibatnya
# setiap giliran baru kehilangan tiga hal, dan ketiganya harus dipasang ulang
# sebelum uji apa pun bisa dijalankan:
#   1. node_modules di drillkit (tsc, vite, esbuild)
#   2. node_modules di qa (puppeteer)
#   3. pustaka bersama Chrome — karena berkas Chrome-nya ada di .cache
#
# Tanpa yang ketiga, puppeteer gagal dengan "Failed to launch the browser
# process: Code: 127" dan pesan tentang libnspr4 yang tidak ketemu.
#
# Pakai (dari akar repo): bash qa/pulihkan.sh
set -u
# 4-CI — repo diturunkan dari lokasi skrip, bukan symlink
# `/home/user/drillkit` (huruf kecil) yang dulu harus dibuat ulang tiap sesi.
AKAR="$(cd "$(dirname "$0")/.." && pwd)"

echo "== 1/3 node_modules: drillkit =="
if [ ! -x "$AKAR"/node_modules/.bin/tsc ]; then
  (cd "$AKAR" && npm install --silent)
fi
[ -x "$AKAR"/node_modules/.bin/tsc ] && echo "    tsc siap" || echo "    GAGAL"

echo "== 2/3 node_modules: qa (puppeteer) =="
if [ ! -d "$AKAR"/qa/node_modules/puppeteer ]; then
  (cd "$AKAR"/qa && npm install --silent)
fi
[ -d "$AKAR"/qa/node_modules/puppeteer ] && echo "    puppeteer siap" || echo "    GAGAL"

echo "== 3/3 pustaka Chrome =="
if ! node -e "require('child_process')" >/dev/null 2>&1; then :; fi
CHROME=$(ls -d /home/user/.cache/puppeteer/chrome/*/chrome-linux64/chrome 2>/dev/null | head -1)
if [ -n "$CHROME" ] && ! ldd "$CHROME" 2>/dev/null | grep -q "not found" ; then
  echo "    pustaka sudah lengkap"
else
  sudo apt-get update -qq >/dev/null 2>&1
  sudo apt-get install -y -qq \
    libnspr4 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 >/dev/null 2>&1
  echo "    dipasang"
fi

echo "== 3b/3 cadangan: chromium sparticuz (bila apt/Chrome bawaan gagal) =="
# Kotak pasir ini hanya menjangkau npm + PyPI: server Debian (apt) dan
# unduhan Chrome puppeteer diblokir. Cadangannya: paket npm
# @sparticuz/chromium (biner + pustaka al2023: libnss3, libnspr4, ...).
# Yang persisten: /home/user/chrome-lib (chromium.br + *.so). Yang harus
# diekstrak ulang tiap sesi: /tmp/chromium (di luar /home/user).
CHROME_SYS=$(ls -d /home/user/.cache/puppeteer/chrome/*/chrome-linux64/chrome 2>/dev/null | head -1)
butuh_cadangan=0
if [ -z "$CHROME_SYS" ]; then butuh_cadangan=1
elif ldd "$CHROME_SYS" 2>/dev/null | grep -q "not found"; then butuh_cadangan=1; fi
if [ "$butuh_cadangan" = 1 ]; then
  mkdir -p /home/user/chromium-rt /home/user/chrome-lib
  if [ ! -f /home/user/chrome-lib/chromium.br ]; then
    (cd /home/user/chromium-rt && npm install --no-save --silent @sparticuz/chromium)
    cp /home/user/chromium-rt/node_modules/@sparticuz/chromium/bin/chromium.br /home/user/chrome-lib/
    node -e "const z=require('zlib'),fs=require('fs');fs.writeFileSync('/tmp/al2023.tar',z.brotliDecompressSync(fs.readFileSync('/home/user/chromium-rt/node_modules/@sparticuz/chromium/bin/al2023.tar.br')))"
    mkdir -p /tmp/al2023 && tar -x -f /tmp/al2023.tar -C /tmp/al2023
    cp /tmp/al2023/lib/*.so* /home/user/chrome-lib/
  fi
  if [ ! -x /tmp/chromium ]; then
    node -e "const z=require('zlib'),fs=require('fs');fs.writeFileSync('/tmp/chromium',z.brotliDecompressSync(fs.readFileSync('/home/user/chrome-lib/chromium.br')))"
    chmod +x /tmp/chromium
  fi
  if [ "$(LD_LIBRARY_PATH=/home/user/chrome-lib ldd /tmp/chromium 2>/dev/null | grep -c 'not found')" = 0 ]; then
    echo "    chromium cadangan siap — uji peramban harus memakai:"
    echo "    export LD_LIBRARY_PATH=/home/user/chrome-lib PUPPETEER_EXECUTABLE_PATH=/tmp/chromium"
  else
    echo "    GAGAL — ldd /tmp/chromium masih kurang pustaka"
  fi
else
  echo "    Chrome bawaan puppeteer siap"
fi

echo "== identitas git =="
if [ -z "$(git -C "$AKAR" config user.name 2>/dev/null)" ]; then
  git -C "$AKAR" config user.name "DrillKit"
  git -C "$AKAR" config user.email "drillkit@local"
  echo "    diatur"
else
  echo "    sudah ada"
fi

echo "== selesai =="
