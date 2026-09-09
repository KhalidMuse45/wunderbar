import { test, expect, type Page } from '@playwright/test';

const fixture = 'http://127.0.0.1:3402';
const signIn = async (page: Page) => {
  await page.goto('/auth/confirm?token_hash=test-invite&type=invite');
  await expect(page).toHaveURL(/\/practice$/);
};

test.beforeEach(async ({ request }) => {
  await request.post(`${fixture}/__test/reset`, { data: {} });
});

test('new invite opens onboarding, saves through the API, and persists after reload', async ({
  page,
  request,
}) => {
  await signIn(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Let’s get to know you.' })).toBeVisible();
  await expect(page.getByText('Your workspace could not be read.', { exact: false })).toHaveCount(
    0,
  );
  await expect(dialog.getByRole('textbox', { name: 'Your name' })).toHaveValue('');

  // Check the actual server validator, independently of browser form validation.
  const rejected = await page.evaluate(async () => {
    const { workspace } = await (await fetch('/api/workspace')).json();
    return (
      await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'profile',
          profile: { ...workspace.profile, name: '   ', onboarded: true },
        }),
      })
    ).status;
  });
  expect(rejected).toBe(400);
  expect((await (await request.get(`${fixture}/__test/state`)).json()).saves).toBe(0);

  await dialog.getByRole('textbox', { name: 'Your name' }).fill('Morgan');
  await dialog.getByRole('button', { name: 'Save my profile' }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await (await request.get(`${fixture}/__test/state`)).json();
  expect(saved.profile).toMatchObject({ name: 'Morgan', onboarded: true });
  expect(saved.saves).toBe(1);
  await page.reload();
  await expect(page.locator('.loading')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit your profile' }).click();
  await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('Morgan');
  expect(await page.evaluate(() => localStorage.getItem('wunderbar-workspace-v1'))).toBeNull();
});

test('a failed profile save preserves input and can be retried', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failSave: true } });
  await signIn(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Your name' }).fill('Morgan');
  await dialog.getByRole('button', { name: 'Save my profile' }).click();
  await expect(dialog.getByRole('alert')).toContainText('could not be saved');
  await expect(dialog.getByRole('textbox', { name: 'Your name' })).toHaveValue('Morgan');
  expect((await (await request.get(`${fixture}/__test/state`)).json()).profile.onboarded).toBe(
    false,
  );
  await request.post(`${fixture}/__test/control`, { data: { failSave: false } });
  await dialog.getByRole('button', { name: 'Save my profile' }).click();
  await expect(dialog).toHaveCount(0);
  expect((await (await request.get(`${fixture}/__test/state`)).json()).profile.onboarded).toBe(
    true,
  );
});

test('a failed initial workspace load recovers into onboarding', async ({ page, request }) => {
  await request.post(`${fixture}/__test/control`, { data: { failLoad: true } });
  await signIn(page);
  await expect(page.locator('.error-banner')).toContainText('could not be loaded');
  await request.post(`${fixture}/__test/control`, { data: { failLoad: false } });
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.loading')).toHaveCount(0);
});

test('returning members bypass onboarding', async ({ page, request }) => {
  await request.post(`${fixture}/__test/reset`, { data: { onboarded: true } });
  await signIn(page);
  await expect(page.locator('.loading')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit your profile' }).click();
  await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('Returning Member');
});

test('expired sessions cannot save onboarding and return to login on reload', async ({
  page,
  request,
}) => {
  await signIn(page);
  await page.getByRole('textbox', { name: 'Your name' }).fill('Morgan');
  await request.post(`${fixture}/__test/control`, { data: { expired: true } });
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/workspace') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save my profile' }).click();
  expect((await response).status()).toBe(401);
  expect((await (await request.get(`${fixture}/__test/state`)).json()).saves).toBe(0);
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
});
