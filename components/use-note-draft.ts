'use client';
import { useEffect, useRef, useState } from 'react';
import { draftKey, readDraft, writeDraft } from '@/lib/drafts';

export function useNoteDraft(
  ownerId: string,
  target: string,
  serverNotes: Record<string, string>,
  connected: boolean,
) {
  const key = draftKey(ownerId, target);
  const [notes, setNotes] = useState(serverNotes);
  const current = useRef(serverNotes);
  const baseline = useRef(JSON.stringify(serverNotes));
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [localSaved, setLocalSaved] = useState(false);
  const localSavedRef = useRef(false);
  const [remoteChanged, setRemoteChanged] = useState(false);
  const serverJson = JSON.stringify(serverNotes);

  useEffect(() => {
    try {
      const draft = readDraft(localStorage, key);
      if (draft && connected && JSON.stringify(draft.notes) === baseline.current) {
        localStorage.removeItem(key);
        setNotice('Your saved notes are up to date.');
      } else if (draft) {
        current.current = draft.notes;
        setNotes(draft.notes);
        localSavedRef.current = true;
        setLocalSaved(true);
        setRemoteChanged(
          connected &&
            draft.base !== baseline.current &&
            JSON.stringify(draft.notes) !== baseline.current,
        );
        setNotice('Recovered your draft from this device.');
      }
    } catch {
      setNotice('Your local draft could not be restored. Browser storage may be unavailable.');
    }
    setReady(true);
  }, [key, connected]);

  useEffect(() => {
    if (!ready || saving || serverJson === baseline.current) return;
    if (JSON.stringify(current.current) === baseline.current) {
      const fresh = JSON.parse(serverJson) as Record<string, string>;
      current.current = fresh;
      setNotes(fresh);
    } else if (JSON.stringify(current.current) !== serverJson) setRemoteChanged(true);
    baseline.current = serverJson;
    if (connected && JSON.stringify(current.current) === serverJson) {
      try {
        localStorage.removeItem(key);
        setLocalSaved(false);
        localSavedRef.current = false;
        setNotice('Your saved notes are up to date.');
      } catch {
        setNotice('Saved notes confirmed, but the device copy could not be cleared.');
      }
    }
  }, [ready, saving, serverJson, connected, key]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      const dirty = JSON.stringify(current.current) !== baseline.current;
      if (dirty && (connected || !localSavedRef.current)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [connected]);

  const persist = (next: Record<string, string>) => {
    try {
      writeDraft(localStorage, key, next, baseline.current);
      localSavedRef.current = true;
      setLocalSaved(true);
      setNotice('Draft saved on this device.');
    } catch {
      localSavedRef.current = false;
      setLocalSaved(false);
      setNotice(
        'Draft could not be saved on this device. Keep this page open and copy your notes before leaving.',
      );
    }
  };
  return {
    notes,
    ready,
    saving,
    notice,
    localSaved,
    remoteChanged,
    dirty: JSON.stringify(notes) !== baseline.current,
    edit(questionId: string, value: string) {
      const next = { ...current.current, [questionId]: value };
      current.current = next;
      setNotes(next);
      persist(next);
    },
    beginSave() {
      setSaving(true);
      return { ...current.current };
    },
    saved(snapshot: Record<string, string>) {
      baseline.current = JSON.stringify(snapshot);
      setRemoteChanged(false);
      if (JSON.stringify(current.current) === baseline.current) {
        try {
          localStorage.removeItem(key);
          setNotice('');
          setLocalSaved(false);
          localSavedRef.current = false;
        } catch {
          setNotice('Notes saved, but the device copy could not be cleared.');
        }
      } else persist(current.current);
      setSaving(false);
    },
    failed() {
      setSaving(false);
    },
    discard() {
      const fresh = JSON.parse(serverJson) as Record<string, string>;
      try {
        localStorage.removeItem(key);
      } catch {
        setNotice('The device copy could not be cleared.');
        return;
      }
      current.current = fresh;
      baseline.current = serverJson;
      setNotes(fresh);
      setRemoteChanged(false);
      setNotice('Local draft discarded.');
      setLocalSaved(false);
      localSavedRef.current = false;
    },
  };
}
