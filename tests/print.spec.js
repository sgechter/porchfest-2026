import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof map !== 'undefined' && activeMarkers.length > 0);
});

// ── beforeprint ────────────────────────────────────────────────────────────

test('beforeprint creates exactly 3 column containers', async ({ page }) => {
  const columnCount = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
    const wrapper = document.getElementById('print-col-wrapper');
    return wrapper ? wrapper.children.length : 0;
  });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  expect(columnCount).toBe(3);
});

test('all venue cards are distributed across the 3 columns', async ({ page }) => {
  const result = await page.evaluate(() => {
    const total = document.querySelectorAll('.venue-card').length;
    window.dispatchEvent(new Event('beforeprint'));
    const wrapper = document.getElementById('print-col-wrapper');
    const distributed = wrapper
      ? [...wrapper.children].reduce((sum, col) => sum + col.querySelectorAll('.venue-card').length, 0)
      : 0;
    window.dispatchEvent(new Event('afterprint'));
    return { total, distributed };
  });
  expect(result.distributed).toBe(result.total);
});

test('each column holds between 25% and 42% of cards', async ({ page }) => {
  const result = await page.evaluate(() => {
    const total = document.querySelectorAll('.venue-card').length;
    window.dispatchEvent(new Event('beforeprint'));
    const wrapper = document.getElementById('print-col-wrapper');
    const counts = wrapper
      ? [...wrapper.children].map(col => col.querySelectorAll('.venue-card').length)
      : [];
    window.dispatchEvent(new Event('afterprint'));
    return { total, counts };
  });
  expect(result.counts).toHaveLength(3);
  for (const count of result.counts) {
    expect(count).toBeGreaterThanOrEqual(Math.floor(result.total * 0.25));
    expect(count).toBeLessThanOrEqual(Math.ceil(result.total * 0.42));
  }
});

// ── afterprint ─────────────────────────────────────────────────────────────

test('afterprint restores cards as direct children of venue-list', async ({ page }) => {
  const result = await page.evaluate(() => {
    const before = document.querySelectorAll('.venue-card').length;
    window.dispatchEvent(new Event('beforeprint'));
    window.dispatchEvent(new Event('afterprint'));
    const directChildren = [...document.getElementById('venue-list').children]
      .filter(el => el.classList.contains('venue-card')).length;
    return { before, directChildren };
  });
  expect(result.directChildren).toBe(result.before);
});

test('afterprint restores venue-list to single flat container (no column wrappers)', async ({ page }) => {
  const columnCount = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
    window.dispatchEvent(new Event('afterprint'));
    return document.getElementById('venue-list').children.length ===
      document.querySelectorAll('#venue-list > .venue-card').length;
  });
  expect(columnCount).toBe(true);
});

// ── Print area matches screen area (REAL print emulation) ─────────────────
// This test catches the bug where the printed map shows a different
// geographic area than what was on screen. It uses Playwright's true print
// media emulation + a viewport sized to the print page (letter @ 0.5in
// margins = 7.5in × 10in = 720 × 960 CSS px) so the layout actually
// reflects the printed page, not the screen window.

// Parse a PPM (P6) image into a Uint8Array of RGB pixel data.
// pdftoppm emits PPM by default — trivial to parse without adding a PNG dep.
function parsePPM(buf) {
  // Header: "P6\n<width> <height>\n<maxval>\n<binary RGB...>"
  let i = 0;
  const readToken = () => {
    while (i < buf.length && /\s/.test(String.fromCharCode(buf[i]))) i++;
    let start = i;
    while (i < buf.length && !/\s/.test(String.fromCharCode(buf[i]))) i++;
    return buf.slice(start, i).toString('ascii');
  };
  const magic = readToken();
  if (magic !== 'P6') throw new Error('Not a P6 PPM: ' + magic);
  const w = parseInt(readToken(), 10);
  const h = parseInt(readToken(), 10);
  const max = parseInt(readToken(), 10);
  if (max !== 255) throw new Error('Unsupported maxval: ' + max);
  i++; // consume single whitespace after maxval
  return { w, h, pixels: buf.slice(i) };
}

// Count distinct colors in a rectangular region of a PPM image.
function distinctColorsInRegion(ppm, x0, y0, x1, y1) {
  const colors = new Set();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * ppm.w + x) * 3;
      colors.add((ppm.pixels[idx] << 16) | (ppm.pixels[idx + 1] << 8) | ppm.pixels[idx + 2]);
    }
  }
  return colors.size;
}

test('print map shows the same markers that were visible on screen', async ({ page }) => {
  // Mirror the actual print sequence:
  //   1. User views at screen size
  //   2. beforeprint fires (page still at screen viewport)
  //   3. @media print + print-page viewport activates
  //   4. matchMedia('print') change listener re-fits bounds
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForFunction(() => typeof map !== 'undefined' && activeMarkers.length > 0);

  // Single-genre filter + explicit view so the test is deterministic
  await page.evaluate(() => {
    document.querySelectorAll('.genre-chip input').forEach(c => { c.checked = c.parentElement.textContent.trim() === 'Bluegrass'; });
    selectedGenres = new Set(['Bluegrass']);
    applyFilters();
    map.setView([42.3876, -71.0995], 14);
  });
  await page.waitForTimeout(200);

  const visibleBefore = await page.evaluate(() => {
    const b = map.getBounds();
    return activeMarkers
      .filter(m => b.contains(m.getLatLng()))
      .map(m => { const ll = m.getLatLng(); return [ll.lat, ll.lng]; });
  });

  // Production sequence: beforeprint first (still at screen viewport),
  // then media + viewport change, then matchMedia listener re-fits.
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: 720, height: 960 });
  await page.waitForTimeout(400);

  const stillVisible = await page.evaluate((pts) => {
    const b = map.getBounds();
    return pts.filter(([lat, lng]) => b.contains([lat, lng])).length;
  }, visibleBefore);

  expect(visibleBefore.length).toBeGreaterThan(0);
  expect(stillVisible).toBe(visibleBefore.length);
});

// ── Tile rendering for print ───────────────────────────────────────────────
// We can't reliably reproduce browser-print-preview rendering inside
// Playwright (page.pdf() uses a different pipeline that doesn't have the
// transform/compositor issue that breaks live Leaflet tiles in browser
// print previews). Instead we verify the *mechanism*: a static <img>
// element with a data: URL is composed from the loaded tiles, the live
// tile pane is hidden in @media print, and the snapshot <img> is shown.
// Standard HTML printing then guarantees the snapshot makes it to paper.

test('print snapshot <img> is composed with rich tile pixel content', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForFunction(() => typeof map !== 'undefined' && activeMarkers.length > 0);
  await page.evaluate(() => map.setView([42.3876, -71.0995], 14));
  await page.waitForTimeout(300);

  // Stub window.print so the button doesn't open the OS print dialog
  await page.evaluate(() => { window.print = () => {}; });
  await page.evaluate(() => document.getElementById('print-btn').click());

  // Wait for the snapshot <img> to load
  await page.waitForFunction(() => {
    const img = document.getElementById('_print-map-snapshot');
    return img && img.complete && img.naturalWidth > 0;
  }, { timeout: 8000 });

  // The snapshot must have substantial pixel data (a blank canvas would
  // encode to ~5KB; a canvas with rendered tiles is many tens of KB).
  // It must also be sized to the print map dimensions exactly.
  const snapInfo = await page.evaluate(() => {
    const img = document.getElementById('_print-map-snapshot');
    return { srcLength: img.src.length, w: img.naturalWidth, h: img.naturalHeight };
  });
  expect(snapInfo.w).toBe(720);
  expect(snapInfo.h).toBe(480);
  expect(snapInfo.srcLength).toBeGreaterThan(30000);

  // Decode the snapshot back into a canvas and count distinct colors —
  // this proves the canvas captured rendered tile pixels (streets, labels,
  // building shades) rather than a flat background fill.
  const colorCount = await page.evaluate(() => {
    const img = document.getElementById('_print-map-snapshot');
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const colors = new Set();
    for (let i = 0; i < d.length; i += 4) {
      colors.add((d[i] << 16) | (d[i+1] << 8) | d[i+2]);
      if (colors.size > 200) break;
    }
    return colors.size;
  });
  // A flat fill yields 1–2 colors. A real street map yields hundreds.
  expect(colorCount).toBeGreaterThan(50);
});

test('@media print hides live tile pane and shows the snapshot', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForFunction(() => typeof map !== 'undefined' && activeMarkers.length > 0);

  // Trigger print prep so the snapshot exists
  await page.evaluate(() => { window.print = () => {}; });
  await page.evaluate(() => document.getElementById('print-btn').click());
  await page.waitForFunction(() => {
    const img = document.getElementById('_print-map-snapshot');
    return img && img.complete && img.naturalWidth > 0;
  }, { timeout: 8000 });

  // Activate @media print rules
  await page.emulateMedia({ media: 'print' });

  const styles = await page.evaluate(() => ({
    tilePane: getComputedStyle(document.querySelector('.leaflet-tile-pane')).display,
    snapshot: getComputedStyle(document.getElementById('_print-map-snapshot')).display,
  }));
  expect(styles.tilePane).toBe('none');
  expect(styles.snapshot).toBe('block');
});

// PDF smoke test: an actual rendered PDF must have non-trivial map content
// in the map region. Headless Chromium prints differently from interactive
// browser dialogs, but this still catches gross regressions (e.g. snapshot
// not in DOM, snapshot src empty, layout completely broken).
test('rendered PDF map region is not blank', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForFunction(() => typeof map !== 'undefined' && activeMarkers.length > 0);
  await page.evaluate(() => map.setView([42.3876, -71.0995], 14));
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.print = () => {}; });
  await page.evaluate(() => document.getElementById('print-btn').click());
  await page.waitForFunction(() => {
    const img = document.getElementById('_print-map-snapshot');
    return img && img.complete && img.naturalWidth > 0;
  }, { timeout: 8000 });

  const pdfBuf = await page.pdf({
    format: 'Letter',
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    printBackground: true,
  });

  const tmp = mkdtempSync(join(tmpdir(), 'porchfest-pdf-'));
  try {
    writeFileSync(join(tmp, 'out.pdf'), pdfBuf);
    execFileSync('pdftoppm', ['-r', '150', '-f', '1', '-l', '1', join(tmp, 'out.pdf'), join(tmp, 'page')]);
    const ppmFile = readdirSync(tmp).find(f => f.endsWith('.ppm'));
    expect(ppmFile).toBeTruthy();
    const ppm = parsePPM(readFileSync(join(tmp, ppmFile)));
    // Sample well inside the map region
    const colors = distinctColorsInRegion(ppm, 275, 275, 975, 775);
    expect(colors).toBeGreaterThan(30);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
