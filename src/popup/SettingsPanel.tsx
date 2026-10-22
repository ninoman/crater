import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { DEFAULT_SETTINGS, SETTING_LIMITS, type Settings } from '../shared/settings';
import { applySpeedPreset, type SpeedPreset, speedPresetOf } from '../shared/settingsPresets';
import {
  Button,
  Disclosure,
  EmptyState,
  NumberField,
  Segmented,
  type SegmentedOption,
  SettingRow,
  StatusDot,
  Toggle,
} from '../ui';
import {
  ADVANCED_KEYS,
  ADVANCED_SECTIONS,
  MAIN_SECTIONS,
  type SettingEntry,
  type SettingSection,
} from './settingsSections';

type ReadyView = Extract<ReturnType<typeof useSettings>['view'], { state: 'ready' }>;
type SpeedChoice = SpeedPreset | 'custom';

const SPEED_OPTIONS: SegmentedOption<SpeedPreset>[] = [
  { value: 'gentle', label: 'Gentle' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
];
const CUSTOM_OPTION: SegmentedOption<SpeedChoice> = { value: 'custom', label: 'Custom' };

function SaveLine({ view }: { view: ReadyView }) {
  const { saveState, errors, dirty } = view;
  if (Object.keys(errors).length > 0)
    return <StatusDot tone="error">Fix the marked fields</StatusDot>;
  if (typeof saveState === 'object') {
    return <StatusDot tone="error">Couldn't save: {saveState.error}</StatusDot>;
  }
  if (saveState === 'saving') return <StatusDot tone="neutral">Saving…</StatusDot>;
  if (dirty) return <StatusDot tone="warning">Unsaved changes</StatusDot>;
  if (saveState === 'saved') return <StatusDot tone="ok">Saved</StatusDot>;
  return null;
}

interface EntryProps {
  entry: SettingEntry;
  view: ReadyView;
  setDraft: (next: Settings) => void;
}

function Entry({ entry, view, setDraft }: EntryProps) {
  const { draft, errors } = view;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft({ ...draft, [key]: value });

  switch (entry.kind) {
    case 'number':
      return (
        <NumberField
          label={entry.label}
          description={entry.description}
          value={draft[entry.key]}
          onChange={(value) => set(entry.key, value)}
          error={errors[entry.key]}
          min={SETTING_LIMITS[entry.key].min}
          max={SETTING_LIMITS[entry.key].max}
        />
      );
    case 'toggle':
      return (
        <Toggle
          label={entry.label}
          description={entry.description}
          checked={draft[entry.key]}
          onChange={(checked) => set(entry.key, checked)}
        />
      );
    case 'speed': {
      const current = speedPresetOf(draft);
      const options = current === 'custom' ? [...SPEED_OPTIONS, CUSTOM_OPTION] : SPEED_OPTIONS;
      return (
        <SettingRow
          label="Scan speed"
          description="How fast Dighead reads Bandcamp in the background. Slower is kinder to Bandcamp."
          group
        >
          {({ describedBy }) => (
            <Segmented<SpeedChoice>
              label="Scan speed"
              options={options}
              value={current}
              describedBy={describedBy}
              onChange={(choice) =>
                choice !== 'custom' && setDraft(applySpeedPreset(draft, choice))
              }
            />
          )}
        </SettingRow>
      );
    }
    case 'lately-rescan':
      return (
        <Toggle
          label="Keep up with your Lately crate mates"
          description="Re-check what your closest Lately crate mates bought more often than everyone else."
          checked={draft.latelyRescanCrateMates > 0}
          onChange={(checked) =>
            set('latelyRescanCrateMates', checked ? DEFAULT_SETTINGS.latelyRescanCrateMates : 0)
          }
        />
      );
  }
}

function Section({ section, ...props }: { section: SettingSection } & Omit<EntryProps, 'entry'>) {
  return (
    <fieldset className="dh-settings__group">
      <legend className="dh-settings__legend">{section.title}</legend>
      {section.entries.map((entry) => (
        <Entry key={'key' in entry ? entry.key : entry.kind} entry={entry} {...props} />
      ))}
    </fieldset>
  );
}

/** Plain-language settings up front, the raw scanner and scoring numbers under Advanced. */
export function SettingsPanel() {
  const { view, setField, save, reset } = useSettings();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  if (view.state === 'loading') return <EmptyState title="Loading settings…" />;
  if (view.state === 'error') {
    return <EmptyState tone="error" title="Couldn't load settings" description={view.error} />;
  }

  const { draft, errors, dirty, saveState } = view;
  const invalid = Object.keys(errors).length > 0;
  // A marked field must stay visible, or "Fix the marked fields" points at nothing.
  const advancedHasError = [...ADVANCED_KEYS].some((key) => errors[key]);
  const setDraft = (next: Settings) => {
    for (const key of Object.keys(next) as (keyof Settings)[]) {
      if (!Object.is(next[key], draft[key])) setField(key, next[key]);
    }
  };

  return (
    <form
      className="dh-settings"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {MAIN_SECTIONS.map((section) => (
        <Section key={section.title} section={section} view={view} setDraft={setDraft} />
      ))}
      <Disclosure
        summary="Advanced"
        open={advancedOpen || advancedHasError}
        onOpenChange={setAdvancedOpen}
      >
        {ADVANCED_SECTIONS.map((section) => (
          <Section key={section.title} section={section} view={view} setDraft={setDraft} />
        ))}
      </Disclosure>
      <div className="dh-settings__footer">
        <span className="dh-settings__status">
          <SaveLine view={view} />
        </span>
        <Button variant="ghost" onClick={reset} disabled={saveState === 'saving'}>
          Reset
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!dirty || invalid || saveState === 'saving'}
        >
          Save
        </Button>
      </div>
    </form>
  );
}
