import { z } from 'zod';

const draftSchema = z.object({
  version: z.literal(1),
  notes: z.record(z.string().max(10000)).refine((notes) => Object.keys(notes).length <= 7),
  base: z.string().max(150000),
});
export const draftPrefix = (ownerId: string) =>
  `wunderbar-draft-v1:${encodeURIComponent(ownerId)}:`;
export const draftKey = (ownerId: string, target: string) =>
  `${draftPrefix(ownerId)}${encodeURIComponent(target)}`;
export function readDraft(storage: Pick<Storage, 'getItem'>, key: string) {
  const raw = storage.getItem(key);
  return raw ? draftSchema.parse(JSON.parse(raw)) : null;
}
export function writeDraft(
  storage: Pick<Storage, 'setItem'>,
  key: string,
  notes: Record<string, string>,
  base: string,
) {
  storage.setItem(key, JSON.stringify(draftSchema.parse({ version: 1, notes, base })));
}
export function clearDrafts(
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'>,
  ownerId: string,
) {
  const prefixes = [draftPrefix(ownerId), `wunderbar-timer-v2:${encodeURIComponent(ownerId)}:`];
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) storage.removeItem(key);
  }
}
