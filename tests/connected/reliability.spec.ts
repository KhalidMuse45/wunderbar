import { test, expect, type Page } from '@playwright/test';
const fixture = 'http://127.0.0.1:3402';
const focus = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event('focus')));
const openGuide = async (page: Page) => {
  await page.goto('/practice#sessions');
  await page.getByRole('button', { name: 'Open session guide' }).click();
  await expect(page.getByRole('textbox', { name: 'Your private notes' })).toBeEnabled();
};
test.beforeEach(async ({ page, request }) => {
  await request.post(`${fixture}/__test/reset`, { data: { onboarded: true, session: true } });
  await request.post(`${fixture}/__test/control`, {
    data: {
      session: {
        starts_at: new Date(Date.now() + 3600000).toISOString(),
        meeting_link: 'https://meet.google.com/old-link',
      },
    },
  });
  await page.goto('/auth/confirm?token_hash=test-invite&type=invite');
  await expect(page.locator('.loading')).toHaveCount(0);
});

test('a committed profile save stays successful when the refresh fails', async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__test/control`, { data: { failReadAfterSave: true } });
  await page.getByRole('button', { name: 'Edit your profile' }).click();
  await page.getByLabel('Your name').fill('Saved Morgan');
  await page.getByRole('button', { name: 'Save my profile' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.error-banner')).toContainText('Your change was saved');
  expect((await (await request.get(`${fixture}/__test/state`)).json()).saves).toBe(1);
  await request.post(`${fixture}/__test/control`, {
    data: { failReadAfterSave: false, failLoad: false },
  });
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.error-banner')).toHaveCount(0);
  expect((await (await request.get(`${fixture}/__test/state`)).json()).saves).toBe(1);
});

test('retrying a bookmark after a lost response does not undo the save', async ({
  page,
  request,
}) => {
  await page.goto('/practice#questions');
  const bookmark = page.locator('.question-row .icon-button').first();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'false');
  await page.route('**/api/workspace', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await bookmark.click();
  await expect(page.getByRole('status')).toContainText('could not confirm this save');
  expect((await (await request.get(`${fixture}/__test/state`)).json()).bookmarks).toHaveLength(1);
  await page.unroute('**/api/workspace');
  await bookmark.click();
  await expect(bookmark).toHaveAttribute('aria-pressed', 'true');
  expect((await (await request.get(`${fixture}/__test/state`)).json()).bookmarks).toHaveLength(1);
});

test('returning to an open guide refreshes cancellation without replacing draft notes', async ({
  page,
  request,
}) => {
  await openGuide(page);
  await page
    .getByLabel('Your private notes')
    .fill('Keep this observation while the partner changes the session.');
  await request.post(`${fixture}/__test/control`, { data: { session: { status: 'cancelled' } } });
  await focus(page);
  await expect(page.getByText('This session is cancelled.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Join meeting', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Your private notes')).toHaveValue(
    'Keep this observation while the partner changes the session.',
  );
});

test('joining checks the newest meeting link before opening it', async ({ page, request }) => {
  await openGuide(page);
  await request.post(`${fixture}/__test/control`, {
    data: { session: { meeting_link: 'https://meet.google.com/new-link' } },
  });
  await page.evaluate(() => {
    window.open = (() => ({
      opener: null,
      location: { replace: (url: string) => sessionStorage.setItem('opened-meeting', url) },
      close: () => sessionStorage.setItem('meeting-closed', 'true'),
    })) as unknown as typeof window.open;
  });
  await page.getByRole('button', { name: 'Join meeting', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('opened-meeting')))
    .toBe('https://meet.google.com/new-link');
});

test('failed note saves survive a reload and recover for retry', async ({ page, request }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await openGuide(page);
  await page
    .getByLabel('Your private notes')
    .fill('Recover this private note after the connection fails.');
  await request.post(`${fixture}/__test/control`, { data: { failNotes: true } });
  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('could not be saved');
  await page.reload();
  await page.getByRole('button', { name: 'Open session guide' }).click();
  await expect(page.getByLabel('Your private notes')).toHaveValue(
    'Recover this private note after the connection fails.',
  );
  await request.post(`${fixture}/__test/control`, { data: { failNotes: false } });
  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  await expect(page.getByText('Notes saved. Only you can see them.')).toBeVisible();
  expect((await (await request.get(`${fixture}/__test/state`)).json()).notes['q-1-1']).toContain(
    'Recover this private note',
  );
});

test('text typed during a save remains a newer local draft', async ({ page, request }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await openGuide(page);
  await request.post(`${fixture}/__test/control`, { data: { notesDelay: 1200 } });
  await page.getByLabel('Your private notes').fill('The first saved version.');
  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeVisible();
  await page
    .getByLabel('Your private notes')
    .fill('A newer thought typed while the save was running.');
  await expect(page.getByRole('button', { name: 'Save notes', exact: true })).toBeEnabled();
  expect((await (await request.get(`${fixture}/__test/state`)).json()).notes['q-1-1']).toBe(
    'The first saved version.',
  );
  await page.reload();
  await page.getByRole('button', { name: 'Open session guide' }).click();
  await expect(page.getByLabel('Your private notes')).toHaveValue(
    'A newer thought typed while the save was running.',
  );
});

test('solo drafts recover after closing and reopening practice', async ({ page }) => {
  await page.goto('/practice#questions');
  await page.locator('.question-open').first().click();
  await page.getByRole('button', { name: 'Practice this question' }).click();
  await page.getByLabel('Your private notes').fill('A solo practice draft worth keeping.');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await page.locator('.question-open').first().click();
  await page.getByRole('button', { name: 'Practice this question' }).click();
  await expect(page.getByLabel('Your private notes')).toHaveValue(
    'A solo practice draft worth keeping.',
  );
});

test('visible workspaces refresh periodically without a focus event', async ({ page, request }) => {
  await page.clock.install();
  await page.goto('/practice#sessions');
  // A hash-only navigation does not reinstall timers under the test clock.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open session guide' })).toBeVisible();
  await request.post(`${fixture}/__test/control`, { data: { session: { status: 'cancelled' } } });
  await page.clock.runFor(30001);
  await expect(page.getByRole('button', { name: /Cancelled · 1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open session guide' })).toHaveCount(0);
});

test('blocked browser storage warns and still permits a server save', async ({ page, request }) => {
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('wunderbar-draft-v1:'))
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  // Open without navigating away so the storage failure remains installed.
  await page.getByRole('button', { name: 'Open session guide' }).first().click();
  await page
    .getByLabel('Your private notes')
    .fill('Keep these notes despite unavailable local storage.');
  await expect(
    page.getByText('Draft could not be saved on this device.', { exact: false }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download notes', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('wunderbar-practice-notes.json');
  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  await expect(page.getByText('Notes saved. Only you can see them.')).toBeVisible();
  expect((await (await request.get(`${fixture}/__test/state`)).json()).notes['q-1-1']).toContain(
    'Keep these notes',
  );
});

test('remote note changes preserve the local draft and ask before replacement', async ({
  page,
  request,
}) => {
  await openGuide(page);
  await page.getByLabel('Your private notes').fill('My current local draft.');
  await request.post(`${fixture}/__test/control`, {
    data: { notes: { 'q-1-1': 'New saved notes from another device.' } },
  });
  await focus(page);
  await expect(
    page.getByText('Saved notes changed on another device.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel('Your private notes')).toHaveValue('My current local draft.');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  expect((await (await request.get(`${fixture}/__test/state`)).json()).notes['q-1-1']).toBe(
    'New saved notes from another device.',
  );
});
