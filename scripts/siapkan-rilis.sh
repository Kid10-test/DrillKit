#!/usr/bin/env bash
#
# Rakit seluruh bundel rilis DrillKit dalam satu perintah:
#   1. `npm run build`          -> `dist/` -> `drillkit-release.zip`
#   2. `scripts/siapkan-unggah.sh` -> `unggah/DrillKit/` + `drillkit-siap-unggah.zip`
#   3. `npm run build:portable` -> `dist-standalone/index.html`
#                               -> `portable/DrillKit.html` -> `drillkit-portable.zip`
#
# Pakai:  bash scripts/siapkan-rilis.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1/3 Membangun versi hosting / PWA (dist/) =="
npm run build

rm -f drillkit-release.zip
zip -qr drillkit-release.zip dist

echo "== 2/3 Menyiapkan bundel unggah tarik-lepas (drillkit-siap-unggah.zip) =="
bash scripts/siapkan-unggah.sh

echo "== 3/3 Membangun versi satu berkas portabel (portable/DrillKit.html) =="
npm run build:portable

rm -rf portable drillkit-portable.zip
mkdir -p portable
cp dist-standalone/index.html portable/DrillKit.html
zip -qr drillkit-portable.zip portable
rm -rf portable unggah

echo ""
echo "== Seluruh bundel rilis siap =="
ls -lh drillkit-portable.zip drillkit-release.zip drillkit-siap-unggah.zip
