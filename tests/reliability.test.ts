import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, reduceWorkspace } from '../lib/model';
import { clearDrafts, draftKey, readDraft, writeDraft } from '../lib/drafts';

test('bookmark retries express a desired state instead of toggling it', () => {
  const save = { type: 'bookmark' as const, id: 'q-1-1', saved: true };
  const once = reduceWorkspace(emptyWorkspace, save);
  assert.deepEqual(reduceWorkspace(once, save).savedQuestions, ['q-1-1']);
  const remove = { ...save, saved: false };
  assert.deepEqual(reduceWorkspace(reduceWorkspace(once, remove), remove).savedQuestions, []);
});

test('drafts recover with a baseline and sign-out clears only the owning account', () => {
  const entries = new Map<string, string>();
  const storage = {
    get length() {
      return entries.size;
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
  const a = draftKey('account-a', 'session');
  const b = draftKey('account-ab', 'session');
  writeDraft(storage, a, { 'q-1-1': 'Private draft' }, '{}');
  writeDraft(storage, b, { 'q-1-1': 'Another account' }, '{}');
  assert.equal(readDraft(storage, a)?.notes['q-1-1'], 'Private draft');
  assert.equal(readDraft(storage, a)?.base, '{}');
  clearDrafts(storage, 'account-a');
  assert.equal(readDraft(storage, a), null);
  assert.equal(readDraft(storage, b)?.notes['q-1-1'], 'Another account');
  entries.set(a, '{"version":1,"notes":{"q-1-1":42},"base":"{}"}');
  assert.throws(() => readDraft(storage, a));
  assert.throws(
    () =>
      writeDraft(
        {
          setItem: () => {
            throw new Error('Quota exceeded');
          },
        },
        a,
        { 'q-1-1': 'Unsaved' },
        '{}',
      ),
    /Quota exceeded/,
  );
});
