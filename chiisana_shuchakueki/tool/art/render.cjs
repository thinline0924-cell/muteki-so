// SVG を PNG/JPEG に書き出す(開発用)。Chromium(Playwright)を使う。
'use strict';
const fs = require('fs');
const path = require('path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.error('playwright が見つかりません。`npm i -g playwright` のあと NODE_PATH を設定してください。');
  process.exit(1);
}

async function renderAll(jobs, { outDir }) {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const job of jobs) {
    const { name, svg, w, h, scale = 1, jpeg = false } = job;
    const W = Math.round(w * scale), H = Math.round(h * scale);
    await page.setViewportSize({ width: W, height: H });
    const html = `<!doctype html><html><head><style>
      html,body{margin:0;padding:0;background:transparent;overflow:hidden}
      svg{display:block;width:${W}px;height:${H}px}
      ${job.css || ''}
      </style></head><body>${svg}</body></html>`;
    await page.setContent(html, { waitUntil: 'load' });
    const file = path.join(outDir, name + (jpeg ? '.jpg' : '.png'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({
      path: file,
      omitBackground: !jpeg,
      type: jpeg ? 'jpeg' : 'png',
      quality: jpeg ? 88 : undefined,
      clip: { x: 0, y: 0, width: W, height: H },
    });
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`${file}  ${W}x${H}  ${kb}KB`);
  }
  await browser.close();
}

module.exports = { renderAll };
