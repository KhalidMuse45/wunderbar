import { test, expect, type Page } from '@playwright/test';
const enter = async (page: Page, view = '') => {
  await page.goto(`/practice?demo=1${view ? `#${view}` : ''}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForFunction(() => !!localStorage.getItem('wunderbar-workspace-v1'));
};

test('landing and workspace render without overflow or console errors', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Good things take practice.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Explore the demo' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/landing-${info.project.name}.png`, fullPage: true });
  await enter(page);
  await expect(page.getByText('Jordan Lee').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/workspace-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test('question filtering, bookmarks, keyboard dialog dismissal, and persistence', async ({
  page,
}) => {
  await enter(page, 'questions');
  await page.getByRole('button', { name: 'Conflict', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search questions' }).fill('teammate');
  await expect(page.locator('.question-row')).toHaveCount(1);
  const bookmark = page.locator('.question-row .icon-button');
  const wasSaved = await bookmark.getAttribute('aria-pressed');
  await bookmark.click();
  await expect(bookmark).toHaveAttribute('aria-pressed', wasSaved === 'true' ? 'false' : 'true');
  await page.locator('.question-open').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('What was your position, in one sentence?')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await page.getByRole('textbox', { name: 'Search questions' }).fill('disagreed with a teammate');
  await expect(page.locator('.question-row .icon-button')).toHaveAttribute(
    'aria-pressed',
    wasSaved === 'true' ? 'false' : 'true',
  );
});
test('availability and profile changes survive reload', async ({ page }) => {
  await enter(page);
  await page.getByRole('button', { name: 'My availability', exact: true }).click();
  const slot = page.getByRole('button', { name: 'Mon 09:00', exact: true });
  await slot.click();
  await page.getByRole('button', { name: 'Save availability', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'My availability', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mon 09:00', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit your profile' }).click();
  await page.getByRole('textbox', { name: 'Your name' }).fill('Morgan');
  await page.getByRole('button', { name: 'Save my profile' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Edit your profile' }).click();
  await expect(page.getByRole('textbox', { name: 'Your name' })).toHaveValue('Morgan');
});
test('create, edit, export, and delete a private story', async ({ page }) => {
  await enter(page, 'stories');
  await page.getByRole('button', { name: 'Add a story', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Give your story a title' })
    .fill('Leading our community workshop');
  await page
    .getByRole('textbox', { name: 'S · Situation' })
    .fill('We planned a workshop for new engineers.');
  await page
    .getByRole('textbox', { name: 'T · Task' })
    .fill('I needed to make it useful for beginners.');
  await page
    .getByRole('textbox', { name: 'A · Action' })
    .fill('I paired each new member with an experienced volunteer.');
  await page
    .getByRole('textbox', { name: 'R · Result' })
    .fill('Every participant finished a working project.');
  await page.getByRole('button', { name: 'Save my story', exact: true }).click();
  await page.reload();
  const card = page.locator('.story-card').filter({ hasText: 'Leading our community workshop' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Keep shaping it' }).click();
  await page
    .getByRole('textbox', { name: 'R · Result' })
    .fill('All 12 participants finished their projects.');
  await page.getByRole('button', { name: 'Save my story', exact: true }).click();
  await page.getByRole('button', { name: 'Edit your profile' }).click();
  const exported = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export my data' }).click();
  expect((await exported).suggestedFilename()).toBe('wunderbar-my-data.json');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await card.getByRole('button', { name: 'Keep shaping it' }).click();
  await page.getByRole('button', { name: 'Delete story' }).click();
  await page.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect(card).toHaveCount(0);
});
test('plan a session, download calendar, practice, save notes, and give feedback', async ({
  page,
}) => {
  await enter(page, 'sessions');
  await page.getByRole('button', { name: 'Plan a session' }).click();
  await page.getByRole('textbox', { name: 'Practice partner’s name' }).fill('Casey Test');
  await page.getByRole('button', { name: 'Plan session', exact: true }).click();
  const card = page.locator('.session-card').filter({ hasText: 'Casey Test' });
  await expect(card).toBeVisible();
  const calendar = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download calendar for Casey Test' }).click();
  expect((await calendar).suggestedFilename()).toMatch(/\.ics$/);
  await card.getByRole('button', { name: 'Open session guide' }).click();
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'I’m interviewing' }).click();
  await expect(page.getByText('What was your specific contribution?')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Your private notes' })
    .fill('A clear example of helping a teammate.');
  await page.getByRole('button', { name: 'Save notes', exact: true }).click();
  await expect(page.getByText('Notes saved. Only you can see them.')).toBeVisible();
  await page.getByRole('button', { name: 'Next question' }).click();
  await expect(page.getByText('QUESTION 2 OF 3')).toBeVisible();
  await page.getByRole('button', { name: 'Finish & give feedback' }).click();
  await page
    .getByRole('textbox', { name: 'One thing that worked' })
    .fill('Your example showed exactly how you helped your teammate.');
  await page
    .getByRole('textbox', { name: 'One change to try next time' })
    .fill('Add a specific outcome to make the result clearer.');
  await page.getByRole('button', { name: 'Finish & save feedback' }).click();
  await page.getByRole('button', { name: /Completed ·/ }).click();
  await expect(page.locator('.session-card').filter({ hasText: 'Casey Test' })).toBeVisible();
  await page.getByRole('button', { name: 'Details for session with Casey Test' }).click();
  await expect(page.getByText('A clear example of helping a teammate.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to my sessions' }).click();
  await page.reload();
  await page.getByRole('button', { name: /Completed ·/ }).click();
  await expect(page.locator('.session-card').filter({ hasText: 'Casey Test' })).toBeVisible();
});

test('mobile navigation supports keyboard closing and hides offscreen controls', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'Mobile-specific navigation.');
  await enter(page);
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('.workspace-body')).toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Question bank', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Find a story worth telling.' })).toBeVisible();
});

test('backend endpoints fail closed when invoked without authentication', async ({ page }) => {
  const crossSite = await page.request.post('/api/workspace', {
    headers: { Origin: 'https://unrelated.example' },
    data: { type: 'cancel', id: 'sample-next' },
  });
  expect(crossSite.status()).toBe(403);
  const worker = await page.request.post('/api/reminders');
  expect(worker.status()).toBe(401);
});
test('feedback notebook is honest about local storage', async ({ page }) => {
  await enter(page, 'ideas');
  await page.getByRole('button', { name: 'Share an idea' }).click();
  await expect(page.getByText(/Your note is saved on this device, not sent/)).toBeVisible();
  await page.getByRole('textbox', { name: 'The short version' }).fill('A better question filter');
  await page
    .getByRole('textbox', { name: 'Tell us a little more' })
    .fill('It would help to filter questions by warm-up difficulty.');
  await page.getByRole('button', { name: 'Save my idea' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A better question filter' })).toBeVisible();
});
