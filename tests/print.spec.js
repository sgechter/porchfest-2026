import { test, expect } from '@playwright/test';

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

test('print map shows the same markers that were visible on screen', async ({ page }) => {
  // 1. View the page at a normal screen size, pick a clear filter to limit markers
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForFunction(() => typeof map !== 'undefined' && activeMarkers.length > 0);

  // Use a single-genre filter so there are a handful of markers to track precisely
  await page.evaluate(() => {
    // Select Bluegrass only
    document.querySelectorAll('.genre-chip input').forEach(c => { c.checked = c.parentElement.textContent.trim() === 'Bluegrass'; });
    selectedGenres = new Set(['Bluegrass']);
    applyFilters();
  });

  // Capture the lat/lng of every visible marker BEFORE printing
  const visibleBefore = await page.evaluate(() => {
    const b = map.getBounds();
    return activeMarkers
      .filter(m => b.contains(m.getLatLng()))
      .map(m => { const ll = m.getLatLng(); return [ll.lat, ll.lng]; });
  });

  // 2. Switch to print media + print page viewport, then trigger print
  await page.emulateMedia({ media: 'print' });
  await page.setViewportSize({ width: 720, height: 960 });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.waitForTimeout(300);

  // 3. After print prep: every marker that was visible on screen must still be
  //    inside the printed map's bounds.
  const stillVisible = await page.evaluate((pts) => {
    const b = map.getBounds();
    return pts.filter(([lat, lng]) => b.contains([lat, lng])).length;
  }, visibleBefore);

  expect(visibleBefore.length).toBeGreaterThan(0);
  expect(stillVisible).toBe(visibleBefore.length);
});
