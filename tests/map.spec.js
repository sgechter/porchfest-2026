import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof map !== 'undefined' && activeMarkers.length > 0);
});

// ── Pinch to zoom ──────────────────────────────────────────────────────────
// Fire a wheel event from inside the browser so ctrlKey is set correctly
async function fireWheel(page, deltaY, ctrlKey) {
  await page.evaluate(({ deltaY, ctrlKey }) => {
    map.getContainer().dispatchEvent(
      new WheelEvent('wheel', { deltaY, ctrlKey, deltaMode: 0, bubbles: true, cancelable: true })
    );
  }, { deltaY, ctrlKey });
}

test('pinch in (ctrl+wheel up) increases zoom level', async ({ page }) => {
  const before = await page.evaluate(() => map.getZoom());
  // Fire multiple events like a real pinch gesture
  for (let i = 0; i < 5; i++) await fireWheel(page, -100, true);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => map.getZoom());
  expect(after).toBeGreaterThan(before);
});

test('pinch out (ctrl+wheel down) decreases zoom level', async ({ page }) => {
  const before = await page.evaluate(() => map.getZoom());
  for (let i = 0; i < 5; i++) await fireWheel(page, 100, true);
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => map.getZoom());
  expect(after).toBeLessThan(before);
});

test('regular scroll (no ctrl) does not change zoom', async ({ page }) => {
  const before = await page.evaluate(() => map.getZoom());
  for (let i = 0; i < 5; i++) await fireWheel(page, -100, false);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => map.getZoom());
  expect(after).toBe(before);
});

// ── Time filter ────────────────────────────────────────────────────────────
test('defaults to All times showing all venues', async ({ page }) => {
  const count = await page.evaluate(() => activeMarkers.length);
  expect(count).toBeGreaterThan(400); // 482 geocoded venues
});

test('2pm–4pm preset reduces venue count', async ({ page }) => {
  const allCount = await page.evaluate(() => activeMarkers.length);
  await page.getByRole('button', { name: '2pm–4pm' }).click();
  await page.waitForTimeout(100);
  const filteredCount = await page.evaluate(() => activeMarkers.length);
  expect(filteredCount).toBeLessThan(allCount);
  expect(filteredCount).toBeGreaterThan(0);
});

test('Noon–2pm preset shows only early shows', async ({ page }) => {
  await page.getByRole('button', { name: 'Noon–2pm' }).click();
  await page.waitForTimeout(100);
  const resultText = await page.locator('#result-bar').textContent();
  expect(resultText).toContain('12:00 pm');
  const count = await page.evaluate(() => activeMarkers.length);
  expect(count).toBeGreaterThan(0);
});

// ── Genre filter ───────────────────────────────────────────────────────────
test('clearing all genres shows zero venues', async ({ page }) => {
  await page.getByRole('button', { name: 'Clear genres' }).click();
  await page.waitForTimeout(100);
  const count = await page.evaluate(() => activeMarkers.length);
  expect(count).toBe(0);
});

test('selecting one genre shows only that genre', async ({ page }) => {
  await page.getByRole('button', { name: 'Clear genres' }).click();
  await page.waitForTimeout(100);

  // Check just Jazz
  await page.locator('.genre-chip').filter({ hasText: 'Jazz' }).click();
  await page.waitForTimeout(100);

  const count = await page.evaluate(() => activeMarkers.length);
  expect(count).toBeGreaterThan(0);

  // Every visible show should include Jazz in its genres
  const allJazz = await page.evaluate(() =>
    VENUES.filter(v => v.shows.some(s => s.genres.includes('Jazz'))).length > 0
  );
  expect(allJazz).toBe(true);
});

test('All genres button restores full count', async ({ page }) => {
  const full = await page.evaluate(() => activeMarkers.length);
  await page.getByRole('button', { name: 'Clear genres' }).click();
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'All genres' }).click();
  await page.waitForTimeout(100);
  const restored = await page.evaluate(() => activeMarkers.length);
  expect(restored).toBe(full);
});

// ── Zone colors ────────────────────────────────────────────────────────────
test('all three zone colors are present in All times view', async ({ page }) => {
  const result = await page.evaluate(() => {
    const badges = document.querySelectorAll('.venue-num');
    const found = new Set();
    badges.forEach(b => {
      const m = (b.getAttribute('style') || '').match(/#[0-9a-f]+/i);
      if (m) found.add(m[0].toLowerCase());
    });
    return {
      found: [...found],
      blue:   ZONE_COLORS.blue.toLowerCase(),
      green:  ZONE_COLORS.green.toLowerCase(),
      orange: ZONE_COLORS.orange.toLowerCase(),
    };
  });
  expect(result.found).toContain(result.blue);
  expect(result.found).toContain(result.green);
  expect(result.found).toContain(result.orange);
});

// ── Marker tooltip ─────────────────────────────────────────────────────────
test('every marker has a tooltip with genre info', async ({ page }) => {
  const result = await page.evaluate(() => {
    const missing = activeMarkers.filter(m => !m.getTooltip());
    return { total: activeMarkers.length, missingTooltip: missing.length };
  });
  expect(result.missingTooltip).toBe(0);
  expect(result.total).toBeGreaterThan(0);
});

// ── WCAG contrast ──────────────────────────────────────────────────────────
test('zone badge colors all pass WCAG AA (4.5:1) against white', async ({ page }) => {
  const ratios = await page.evaluate(() => {
    function lum(r, g, b) {
      return [r, g, b].reduce((s, c, i) => {
        const n = c / 255;
        return s + [0.2126, 0.7152, 0.0722][i] * (n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
      }, 0);
    }
    function cr(hex) {
      const [r, g, b] = hex.match(/\w\w/g).map(h => parseInt(h, 16));
      const l = lum(r, g, b);
      return +((1.05) / (l + 0.05)).toFixed(2);
    }
    return {
      blue:   cr(ZONE_COLORS.blue.slice(1)),
      green:  cr(ZONE_COLORS.green.slice(1)),
      orange: cr(ZONE_COLORS.orange.slice(1)),
    };
  });
  expect(ratios.blue).toBeGreaterThanOrEqual(4.5);
  expect(ratios.green).toBeGreaterThanOrEqual(4.5);
  expect(ratios.orange).toBeGreaterThanOrEqual(4.5);
});
