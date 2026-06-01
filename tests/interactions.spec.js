import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => typeof map !== 'undefined' && activeMarkers.length > 0);
});

// ── Double popup / tooltip conflict ───────────────────────────────────────

test('opening a popup unbinds the tooltip entirely', async ({ page }) => {
  // closeTooltip() alone isn't enough on mobile — synthetic mouseover re-opens it.
  // We need unbindTooltip() so there's nothing to re-open.
  const tooltipBound = await page.evaluate(() => {
    activeMarkers[0].openTooltip();
    activeMarkers[0].openPopup();
    return activeMarkers[0].getTooltip() !== null; // should be null after unbind
  });
  expect(tooltipBound).toBe(false);
});

test('closing a popup re-binds the tooltip', async ({ page }) => {
  const tooltipReboundAfterClose = await page.evaluate(() => {
    activeMarkers[0].openPopup();
    activeMarkers[0].closePopup();
    return activeMarkers[0].getTooltip() !== null;
  });
  expect(tooltipReboundAfterClose).toBe(true);
});

// ── Slider fill direction ─────────────────────────────────────────────────

test('time-start slider has a gradient background (not just accent-color)', async ({ page }) => {
  const bg = await page.evaluate(() =>
    document.getElementById('time-start').style.background
  );
  expect(bg).toContain('linear-gradient');
});

test('time-start slider gradient has grey on the left (before thumb)', async ({ page }) => {
  // Move start to 25% of range (810 min = 1:30pm)
  await page.evaluate(() => {
    const el = document.getElementById('time-start');
    el.value = 810;
    el.dispatchEvent(new Event('input'));
  });
  const bg = await page.evaluate(() => document.getElementById('time-start').style.background);
  expect(bg).toContain('linear-gradient');
  // Browser normalizes hex → rgb. Grey (ddd) must appear before green in the gradient string.
  const greyIdx  = bg.indexOf('221, 221, 221'); // rgb(221,221,221) = #ddd
  const greenIdx = bg.indexOf('44, 95, 46');    // rgb(44,95,46)   = #2c5f2e
  expect(greyIdx).toBeGreaterThan(-1);
  expect(greyIdx).toBeLessThan(greenIdx);
});

test('time-end slider gradient has grey on the right (after thumb)', async ({ page }) => {
  // Move end to 75% of range (990 min = 4:30pm)
  await page.evaluate(() => {
    const el = document.getElementById('time-end');
    el.value = 990;
    el.dispatchEvent(new Event('input'));
  });
  const bg = await page.evaluate(() => document.getElementById('time-end').style.background);
  expect(bg).toContain('linear-gradient');
  // Green (2c5f2e) must appear before grey (ddd) in the gradient string.
  const greenIdx    = bg.indexOf('44, 95, 46');
  const greyLastIdx = bg.lastIndexOf('221, 221, 221');
  expect(greenIdx).toBeGreaterThan(-1);
  expect(greyLastIdx).toBeGreaterThan(greenIdx);
});

// ── Print zoom preservation ───────────────────────────────────────────────

test('beforeprint resizes map to print dimensions and preserves center/zoom', async ({ page }) => {
  await page.evaluate(() => map.setView([42.395, -71.108], 15, { animate: false }));
  await page.waitForTimeout(150);

  const before = await page.evaluate(() => ({
    lat:  map.getCenter().lat,
    lng:  map.getCenter().lng,
    zoom: map.getZoom(),
  }));

  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => ({
    lat:      map.getCenter().lat,
    lng:      map.getCenter().lng,
    zoom:     map.getZoom(),
    mapH:     document.getElementById('map').style.height,
    // #main must be forced to block so invalidateSize reads final print width
    mainDisplay: document.getElementById('main').style.display,
  }));

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));

  expect(after.mapH).toBe('480px');
  expect(after.mainDisplay).toBe('block');
  expect(after.zoom).toBeCloseTo(before.zoom, 0);
  expect(after.lat).toBeCloseTo(before.lat, 3);
  expect(after.lng).toBeCloseTo(before.lng, 3);
});
