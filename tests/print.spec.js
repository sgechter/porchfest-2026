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
