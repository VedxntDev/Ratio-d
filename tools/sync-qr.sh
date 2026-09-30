#!/bin/sh
# single source: js/qr.js + js/vendor/jsQR.js -> extension copies (test-qr.js fails on drift)
cd "$(dirname "$0")/.." || exit 1
cp js/qr.js extension/qr-core.js
cp js/vendor/jsQR.js extension/jsQR.js
echo "synced"
