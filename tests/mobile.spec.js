import { test, expect } from '@playwright/test';

const MOBILE = { width: 390, height: 844 }; // iPhone 14

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  await page.waitForFunction(() => typeof map !== 'undefined' && activeMarkers.length > 0);
});

// ── Layout ─────────────────────────────────────────────────────────────────

test('map has meaningful height on mobile', async ({ page }) => {
  const height = await page.evaluate(() =>
    document.getElementById('map').getBoundingClientRect().height
  );
  expect(height).toBeGreaterThanOrEqual(250);
});

test('map does not overflow viewport width', async ({ page }) => {
  const { mapWidth, viewportWidth } = await page.evaluate(() => ({
    mapWidth: document.getElementById('map').getBoundingClientRect().width,
    viewportWidth: window.innerWidth,
  }));
  expect(mapWidth).toBeLessThanOrEqual(viewportWidth);
});

test('venue list is visible below the map', async ({ page }) => {
  const { mapBottom, listTop, listHeight } = await page.evaluate(() => {
    const mapRect  = document.getElementById('map').getBoundingClientRect();
    const listRect = document.getElementById('venue-list').getBoundingClientRect();
    return {
      mapBottom:  mapRect.bottom,
      listTop:    listRect.top,
      listHeight: listRect.height,
    };
  });
  // List starts at or after the map bottom (stacked, not side-by-side)
  expect(listTop).toBeGreaterThanOrEqual(mapBottom - 1);
  expect(listHeight).toBeGreaterThan(0);
});

test('layout is stacked (map above list), not side-by-side', async ({ page }) => {
  const { mapRight, listLeft, viewportWidth } = await page.evaluate(() => {
    const mapRect  = document.getElementById('map').getBoundingClientRect();
    const listRect = document.getElementById('venue-list').getBoundingClientRect();
    return {
      mapRight:      mapRect.right,
      listLeft:      listRect.left,
      viewportWidth: window.innerWidth,
    };
  });
  // In a side-by-side layout, listLeft ≈ mapRight.
  // In a stacked layout, listLeft is near 0 and mapRight fills the viewport.
  expect(mapRight).toBeGreaterThan(viewportWidth * 0.8);
  expect(listLeft).toBeLessThan(viewportWidth * 0.2);
});

// ── Filters still work at mobile viewport ──────────────────────────────────

test('time filter preset works on mobile', async ({ page }) => {
  const allCount = await page.evaluate(() => activeMarkers.length);
  await page.getByRole('button', { name: '2pm–4pm' }).click();
  await page.waitForTimeout(100);
  const filteredCount = await page.evaluate(() => activeMarkers.length);
  expect(filteredCount).toBeLessThan(allCount);
  expect(filteredCount).toBeGreaterThan(0);
});

test('genre filter works on mobile', async ({ page }) => {
  await page.getByRole('button', { name: 'Clear genres' }).click();
  await page.waitForTimeout(100);
  const count = await page.evaluate(() => activeMarkers.length);
  expect(count).toBe(0);
});

// ── Scrollability ───────────────────────────────────────────────────────────

test('venue list is tall enough to show at least 3 cards on mobile', async ({ page }) => {
  const { listHeight, cardHeight } = await page.evaluate(() => ({
    listHeight: document.getElementById('list-panel').offsetHeight,
    cardHeight: document.querySelector('.venue-card')?.offsetHeight ?? 0,
  }));
  expect(listHeight).toBeGreaterThanOrEqual(cardHeight * 3);
});
