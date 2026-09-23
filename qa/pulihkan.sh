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
# Pakai: bash /home/user/drillkit/qa/pulihkan.sh
set -u

echo "== 1/3 node_modules: drillkit =="
if [ ! -x /home/user/drillkit/node_modules/.bin/tsc ]; then
  (cd /home/user/drillkit && npm install --silent)
fi
[ -x /home/user/drillkit/node_modules/.bin/tsc ] && echo "    tsc siap" || echo "    GAGAL"

echo "== 2/3 node_modules: qa (puppeteer) =="
if [ ! -d /home/user/drillkit/qa/node_modules/puppeteer ]; then
  (cd /home/user/drillkit/qa && npm install --silent)
fi
[ -d /home/user/drillkit/qa/node_modules/puppeteer ] && echo "    puppeteer siap" || echo "    GAGAL"

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

echo "== identitas git =="
if [ -z "$(git -C /home/user/drillkit config user.name 2>/dev/null)" ]; then
  git -C /home/user/drillkit config user.name "DrillKit"
  git -C /home/user/drillkit config user.email "drillkit@local"
  echo "    diatur"
else
  echo "    sudah ada"
fi

echo "== selesai =="
