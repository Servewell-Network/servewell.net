import { expect, test } from '@playwright/test';

test('features page loads and contains table rows', async ({ page }) => {
  await page.goto('/features');
  await expect(page.locator('h1')).toContainText('Features');
  const rowCount = await page.locator('.features-table tbody tr').count();
  expect(rowCount).toBeGreaterThan(0);

  const ids = await page.locator('.features-table tbody tr').evaluateAll((rows) =>
    rows.map((row) => row.id).filter((id) => id.startsWith('need-'))
  );
  expect(ids.length).toBeGreaterThan(0);
  expect(ids.some((id) => id.startsWith('feat-'))).toBe(false);
});

test('whats-next page loads and contains table rows', async ({ page }) => {
  await page.goto('/whats-next');
  await expect(page.locator('h1')).toContainText("What's Next");
  const rowCount = await page.locator('.features-table tbody tr').count();
  expect(rowCount).toBeGreaterThan(0);
});

test('visual preview page advances slides', async ({ page }) => {
  await page.goto('/visual-test-preview.html');
  await expect(page.locator('h1')).toContainText('Visual Pre-Deploy Preview');
  await expect(page.locator('#slideCounter')).toContainText('Slide 1');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#slideCounter')).toContainText('Slide 2');
});

test('task popover opens from feature name click', async ({ page }) => {
  await page.goto('/features');
  const firstTask = page.locator('.task-name').first();
  await firstTask.click();
  await expect(page.locator('#popoverPanel')).toBeVisible();
  await expect(page.locator('#popoverTitle')).not.toHaveText('');
});

test('vote popover renders vote controls and accepts click', async ({ page }) => {
  await page.goto('/features');
  const firstVotesCell = page.locator('.votes-cell').first();
  await firstVotesCell.click();

  const upBtn = page.locator('#voteUpBtn');
  const downBtn = page.locator('#voteDownBtn');
  await expect(upBtn).toBeVisible();
  await expect(downBtn).toBeVisible();

  const voteResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/vote/') && response.request().method() === 'POST'
  );
  await upBtn.click();
  const voteResponse = await voteResponsePromise;
  expect([200, 400]).toContain(voteResponse.status());
  if (voteResponse.status() === 400) {
    const body = await voteResponse.json() as { error?: string };
    const errorText = body.error || '';
    expect(errorText).toContain('already voted');
    await expect(page.locator('#voteFeedbackPopover')).toContainText(errorText);
  }

  await expect(firstVotesCell.locator('.votes-unverified')).toBeVisible();
});

test('verse number popover shows link action and copy feedback', async ({ page }) => {
  await page.goto('/-/Revelation/22');

  const verseButton = page.locator('button.verse-num:visible').first();
  await verseButton.click();

  const versePopover = page.locator('#verse-number-popover');
  await expect(versePopover).toBeVisible();
  await expect(versePopover).toContainText('More content coming here soon');

  await versePopover.getByRole('button', { name: 'Link' }).click();
  await expect(page.locator('#verse-link-copied-popover')).toContainText('link copied');
});

test('auth modal opens from auth button', async ({ page }) => {
  await page.goto('/features');
  await page.evaluate(() => {
    const button = document.querySelector('[data-auth-button]') as HTMLButtonElement | null;
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect(page.locator('[data-auth-modal]')).toBeVisible();
  await expect(page.locator('[data-auth-modal] [data-auth-email]')).toBeVisible();
});

test('responsive layouts keep key interactions usable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 600 });
  await page.goto('/features');
  await expect(page.locator('h1')).toContainText('Features');
  await expect(page.locator('.task-name').first()).toBeVisible();
  await page.locator('.task-name').first().click();
  await expect(page.locator('#popoverPanel')).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/whats-next');
  await expect(page.locator('h1')).toContainText("What's Next");
  await expect(page.locator('.task-name').first()).toBeVisible();
  await page.locator('.task-name').first().click();
  await expect(page.locator('#popoverPanel')).toBeVisible();
});
