import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

mkdirSync('public', { recursive: true });

// 1. Favicon SVG (64x64) - crisp, high-contrast for browser tabs
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="favBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#145443"/>
      <stop offset="100%" stop-color="#103B31"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#favBg)"/>
  <!-- Quadro loop of Q -->
  <path fill-rule="evenodd" clip-rule="evenodd" d="
    M 20 12
    C 14.5 12, 12 14.5, 12 20
    L 12 34
    C 12 39.5, 14.5 42, 20 42
    L 32 42
    C 37.5 42, 40 39.5, 40 34
    L 40 20
    C 40 14.5, 37.5 12, 32 12
    Z
    M 21.5 18.5
    C 18.5 18.5, 18 19, 18 22
    L 18 32
    C 18 35, 18.5 35.5, 21.5 35.5
    L 30.5 35.5
    C 33.5 35.5, 34 35, 34 32
    L 34 22
    C 34 19, 33.5 18.5, 30.5 18.5
    Z
  " fill="#FFFFFF"/>
  <!-- Q Dynamic organizer tail -->
  <rect x="31" y="31" width="18" height="7.2" rx="3.6" transform="rotate(45 31 31)" fill="#FFFFFF"/>
  <!-- Subtle inner list bar -->
  <rect x="22" y="24" width="8" height="2" rx="1" fill="#EAF3EE" opacity="0.9"/>
  <rect x="22" y="28" width="5.5" height="2" rx="1" fill="#EAF3EE" opacity="0.9"/>
</svg>`;

// 2. Principal Logo Symbol SVG (512x512) - Transparent background, detailed Quadro/Organizer Q
const logoSymbolSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="qGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#145443"/>
      <stop offset="100%" stop-color="#103B31"/>
    </linearGradient>
  </defs>
  <!-- Q Quadro Frame -->
  <path fill-rule="evenodd" clip-rule="evenodd" d="
    M 160 56
    C 102 56, 76 82, 76 140
    L 76 272
    C 76 330, 102 356, 160 356
    L 292 356
    C 350 356, 376 330, 376 272
    L 376 140
    C 376 82, 350 56, 292 56
    Z
    M 172 116
    C 142 116, 134 124, 134 154
    L 134 258
    C 134 288, 142 296, 172 296
    L 280 296
    C 310 296, 318 288, 318 258
    L 318 154
    C 318 124, 310 116, 280 116
    Z
  " fill="url(#qGrad)"/>
  <!-- Q Tail -->
  <rect x="296" y="296" width="150" height="58" rx="29" transform="rotate(45 296 296)" fill="url(#qGrad)"/>
  <!-- Organizer list lines (quadro / rol) inside the counter -->
  <rect x="168" y="166" width="116" height="18" rx="9" fill="#145443" opacity="0.9"/>
  <rect x="168" y="206" width="116" height="18" rx="9" fill="#145443" opacity="0.9"/>
  <rect x="168" y="246" width="76" height="18" rx="9" fill="#145443" opacity="0.9"/>
</svg>`;

// 3. Horizontal Logo SVG (640x160) - Symbol + Wordmark
const logoHorizontalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" width="640" height="160">
  <defs>
    <linearGradient id="qGradH" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#145443"/>
      <stop offset="100%" stop-color="#103B31"/>
    </linearGradient>
  </defs>
  <!-- Símbolo Q estilizado -->
  <g transform="translate(18, 18) scale(0.242)">
    <path fill-rule="evenodd" clip-rule="evenodd" d="
      M 160 56
      C 102 56, 76 82, 76 140
      L 76 272
      C 76 330, 102 356, 160 356
      L 292 356
      C 350 356, 376 330, 376 272
      L 376 140
      C 376 82, 350 56, 292 56
      Z
      M 172 116
      C 142 116, 134 124, 134 154
      L 134 258
      C 134 288, 142 296, 172 296
      L 280 296
      C 310 296, 318 288, 318 258
      L 318 154
      C 318 124, 310 116, 280 116
      Z
    " fill="url(#qGradH)"/>
    <rect x="296" y="296" width="150" height="58" rx="29" transform="rotate(45 296 296)" fill="url(#qGradH)"/>
    <rect x="168" y="166" width="116" height="18" rx="9" fill="#145443" opacity="0.9"/>
    <rect x="168" y="206" width="116" height="18" rx="9" fill="#145443" opacity="0.9"/>
    <rect x="168" y="246" width="76" height="18" rx="9" fill="#145443" opacity="0.9"/>
  </g>
  <!-- Wordmark -->
  <text x="162" y="93" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="68" font-weight="700" letter-spacing="-1.8" fill="#103B31">quadrei</text>
  <text x="166" y="122" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="650" letter-spacing="3.2" fill="#52645B">GESTÃO DE SOCIEDADES</text>
</svg>`;

// Write SVG files
writeFileSync('public/favicon.svg', faviconSvg);
writeFileSync('public/logo.svg', logoSymbolSvg);
writeFileSync('public/logo-horizontal.svg', logoHorizontalSvg);

// Write ICO binary helper
function pngToIco(pngBuffer, width, height) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // icon type
  header.writeUInt16LE(1, 4); // count
  header.writeUInt8(width >= 256 ? 0 : width, 6);
  header.writeUInt8(height >= 256 ? 0 : height, 7);
  header.writeUInt8(0, 8); // color count
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bpp
  header.writeUInt32LE(pngBuffer.length, 14); // bytes
  header.writeUInt32LE(22, 18); // offset
  return Buffer.concat([header, pngBuffer]);
}

async function renderAssets() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });

  // Render 32x32 Favicon PNG
  const page32 = await browser.newPage({ viewport: { width: 32, height: 32 } });
  await page32.setContent(`<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}svg{display:block;width:32px;height:32px;}</style>${faviconSvg.replace('width="64" height="64"', 'width="32" height="32"')}`);
  const buf32 = await page32.screenshot({ omitBackground: true });
  writeFileSync('public/favicon-32.png', buf32);

  // Write ICO
  const icoBuf = pngToIco(buf32, 32, 32);
  writeFileSync('public/favicon.ico', icoBuf);

  // Render 192x192 Favicon PNG
  const page192 = await browser.newPage({ viewport: { width: 192, height: 192 } });
  await page192.setContent(`<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}svg{display:block;width:192px;height:192px;}</style>${faviconSvg.replace('width="64" height="64"', 'width="192" height="192"')}`);
  const buf192 = await page192.screenshot({ omitBackground: true });
  writeFileSync('public/favicon-192.png', buf192);

  // Render 512x512 Logo PNG (Transparent background)
  const page512 = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page512.setContent(`<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}svg{display:block;width:512px;height:512px;}</style>${logoSymbolSvg}`);
  const buf512 = await page512.screenshot({ omitBackground: true });
  writeFileSync('public/logo-512.png', buf512);

  // Render Horizontal Logo PNG (Transparent background)
  const pageH = await browser.newPage({ viewport: { width: 640, height: 160 } });
  await pageH.setContent(`<style>html,body{margin:0;padding:0;overflow:hidden;background:transparent;}svg{display:block;width:640px;height:160px;}</style>${logoHorizontalSvg}`);
  const bufH = await pageH.screenshot({ omitBackground: true });
  writeFileSync('public/logo-horizontal.png', bufH);

  await browser.close();
  console.log('All brand assets successfully generated!');
}

renderAssets().catch(err => {
  console.error(err);
  process.exit(1);
});
