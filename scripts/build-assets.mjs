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
  <!-- Três pessoas reunidas em torno de um centro comum -->
  <circle cx="22" cy="23" r="5" fill="#FFFFFF"/><circle cx="42" cy="23" r="5" fill="#FFFFFF"/>
  <circle cx="32" cy="18" r="6" fill="#FFFFFF"/>
  <path d="M12 45c0-7 4-11 10-11 3 0 5 1 7 3M52 45c0-7-4-11-10-11-3 0-5 1-7 3M19 48c0-10 5-15 13-15s13 5 13 15" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
</svg>`;

// 2. Principal Logo Symbol SVG (512x512) - Pessoas reunidas em comunidade
const logoSymbolSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="qGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#145443"/>
      <stop offset="100%" stop-color="#103B31"/>
    </linearGradient>
  </defs>
  <circle cx="176" cy="192" r="58" fill="url(#qGrad)"/><circle cx="336" cy="192" r="58" fill="url(#qGrad)"/>
  <circle cx="256" cy="128" r="70" fill="url(#qGrad)"/>
  <path d="M64 408c0-88 48-136 112-136 36 0 66 15 84 43M448 408c0-88-48-136-112-136-36 0-66 15-84 43M120 432c0-112 48-176 136-176s136 64 136 176" fill="none" stroke="url(#qGrad)" stroke-width="44" stroke-linecap="round"/>
</svg>`;

// 3. Horizontal Logo SVG (640x160) - Symbol + Wordmark
const logoHorizontalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" width="640" height="160">
  <defs>
    <linearGradient id="qGradH" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#145443"/>
      <stop offset="100%" stop-color="#103B31"/>
    </linearGradient>
  </defs>
  <!-- Símbolo de pessoas reunidas -->
  <g transform="translate(18, 18) scale(0.242)"><circle cx="176" cy="192" r="58" fill="url(#qGradH)"/><circle cx="336" cy="192" r="58" fill="url(#qGradH)"/><circle cx="256" cy="128" r="70" fill="url(#qGradH)"/><path d="M64 408c0-88 48-136 112-136 36 0 66 15 84 43M448 408c0-88-48-136-112-136-36 0-66 15-84 43M120 432c0-112 48-176 136-176s136 64 136 176" fill="none" stroke="url(#qGradH)" stroke-width="44" stroke-linecap="round"/></g>
  <!-- Wordmark -->
  <text x="162" y="93" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="59" font-weight="700" letter-spacing="-1.2" fill="#103B31">Ecluniva</text>
  <text x="166" y="122" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="650" letter-spacing="2" fill="#52645B">PESSOAS, ENCONTROS E HISTÓRIA</text>
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
