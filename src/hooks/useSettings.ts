import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadSettings,
  resetSettings,
  saveSettings,
  validateSettings,
  type Settings,
  type SettingsErrors,
} from '../shared/settings';

export type SettingsView =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | {
      state: 'ready';
      draft: Settings;
      errors: SettingsErrors;
      /** The draft differs from what's stored. */
      dirty: boolean;
      /** What the last save or reset did, until the next edit. */
      saveState: 'idle' | 'saving' | 'saved' | { error: string };
    };

export interface SettingsForm {
  view: SettingsView;
  setField: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  save: () => void;
  reset: () => void;
}

/**
 * An editable copy of the settings. Settings live in chrome.storage, which the popup can reach
 * directly; the worker re-reads them before every request, so a save applies right away.
 */
export function useSettings(): SettingsForm {
  const [stored, setStored] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] =
    useState<Extract<SettingsView, { state: 'ready' }>['saveState']>('idle');

  useEffect(() => {
    let cancelled = false;
    loadSettings().then(
      (settings) => {
        if (cancelled) return;
        setStored(settings);
        setDraft(settings);
      },
      (error: unknown) => !cancelled && setLoadError(String(error)),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const errors = useMemo(() => (draft ? validateSettings(draft) : {}), [draft]);

  const setField = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setSaveState('idle');
  }, []);

  const apply = useCallback((write: Promise<Settings>) => {
    setSaveState('saving');
    write.then(
      (settings) => {
        setStored(settings);
        setDraft(settings);
        setSaveState('saved');
      },
      (error: unknown) => setSaveState({ error: String(error) }),
    );
  }, []);

  const save = useCallback(() => {
    if (draft && Object.keys(validateSettings(draft)).length === 0) apply(saveSettings(draft));
  }, [apply, draft]);

  const reset = useCallback(() => apply(resetSettings()), [apply]);

  let view: SettingsView;
  if (loadError !== null) view = { state: 'error', error: loadError };
  else if (!draft || !stored) view = { state: 'loading' };
  else {
    const dirty = (Object.keys(draft) as (keyof Settings)[]).some(
      (key) => !Object.is(draft[key], stored[key]),
    );
    view = { state: 'ready', draft, errors, dirty, saveState };
  }

  return { view, setField, save, reset };
}
