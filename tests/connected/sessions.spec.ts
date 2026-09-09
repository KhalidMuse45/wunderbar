import { test, expect } from '@playwright/test';
const fixture = 'http://127.0.0.1:3402';

test.beforeEach(async ({ page, request }) => {
  await request.post(`${fixture}/__test/reset`, { data: { onboarded: true, session: true } });
  await page.goto('/auth/confirm?token_hash=test-invite&type=invite');
  await expect(page).toHaveURL(/\/practice$/);
  await expect(page.locator('.loading')).toHaveCount(0);
});

test('custom windows save through the API and survive reload', async ({ page, request }) => {
  await page.getByRole('button', { name: 'My availability', exact: true }).click();
  await page.getByLabel('Custom start time').fill('10:15');
  await page.getByRole('button', { name: 'Add one-hour window' }).click();
  await page.getByRole('button', { name: 'Save availability', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json()).profile.availability,
  ).toContain('Mon-10:15');
  await page.reload();
  await page.getByRole('button', { name: 'My availability', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Mon-10:15' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove Mon-10:15' }).click();
  await page.getByRole('button', { name: 'Save availability', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    (await (await request.get(`${fixture}/__test/state`)).json()).profile.availability,
  ).not.toContain('Mon-10:15');
});

test('elapsed sessions need an explicit outcome before separate peer feedback', async ({
  page,
  request,
}) => {
  await page.goto('/practice#sessions');
  await page.getByRole('button', { name: /Needs outcome · 1/ }).click();
  const card = page.locator('.session-card').filter({ hasText: 'Casey' });
  await expect(card.getByRole('button', { name: 'Leave feedback', exact: true })).toHaveCount(0);
  await card.getByRole('button', { name: 'Record outcome' }).click();
  await page.getByRole('button', { name: 'Save outcome', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  let state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.sessions[0].status).toBe('completed');
  expect(state.reviews).toHaveLength(0);
  await page.getByRole('button', { name: /Completed · 1/ }).click();
  await expect(card).toContainText('Your feedback: Pending');
  await card.getByRole('button', { name: 'Leave feedback', exact: true }).click();
  await page.getByLabel('One thing that worked').fill('Your story explained the problem clearly.');
  await page.getByLabel('One change to try next time').fill('Include a specific result next time.');
  await page.getByRole('button', { name: 'Finish & save feedback' }).click();
  await expect(card).toContainText('Your feedback: Sent');
  await expect(card).toContainText('Partner feedback: Pending');
  state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.sessions[0].status).toBe('completed');
  expect(state.reviews).toHaveLength(1);
  await card.getByRole('button', { name: 'Edit my feedback' }).click();
  await expect(page.getByLabel('One thing that worked')).toHaveValue(
    'Your story explained the problem clearly.',
  );
});

test('a session that did not happen is separate from completed interviews', async ({
  page,
  request,
}) => {
  await page.goto('/practice#sessions');
  await page.getByRole('button', { name: /Needs outcome · 1/ }).click();
  await page.getByRole('button', { name: 'Record outcome' }).click();
  await page.getByLabel('Session outcome').selectOption('no_show');
  await page.getByRole('button', { name: 'Save outcome', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /Did not take place · 1/ }).click();
  await expect(page.locator('.session-card').filter({ hasText: 'Casey' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leave feedback', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Completed · 0/ })).toBeVisible();
  const state = await (await request.get(`${fixture}/__test/state`)).json();
  expect(state.sessions[0].status).toBe('no_show');
  expect(state.reviews).toHaveLength(0);
});
