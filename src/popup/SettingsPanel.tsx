import { useSettings } from '../hooks/useSettings';
import {
  SETTING_LIMITS,
  type BooleanSetting,
  type NumericSetting,
  type Settings,
} from '../shared/settings';
import { Button, EmptyState, NumberField, StatusDot, Toggle } from '../ui';

interface Group {
  title: string;
  fields: { key: NumericSetting; label: string }[];
  toggles?: { key: BooleanSetting; label: string }[];
}

const GROUPS: Group[] = [
  {
    title: 'Pace',
    fields: [
      { key: 'paceMinMs', label: 'Min gap (ms)' },
      { key: 'paceMaxMs', label: 'Max gap (ms)' },
      { key: 'dailyRequestBudget', label: 'Requests per day' },
    ],
    toggles: [{ key: 'seedFromCollection', label: 'Scan supporters of releases you own' }],
  },
  {
    title: 'Caps',
    fields: [
      { key: 'collectionCap', label: 'Items per fan' },
      { key: 'collectionBatchSize', label: 'Items per request' },
      { key: 'supportersPerReleaseCap', label: 'Supporters per release' },
    ],
  },
  {
    title: 'Taste twins',
    fields: [
      { key: 'minCollectionSize', label: 'Min collection' },
      { key: 'maxCollectionSize', label: 'Max collection' },
      { key: 'topTwinsK', label: 'Twins used (K)' },
      { key: 'latelyHalfLifeMonths', label: 'Lately half-life (months)' },
      { key: 'latelyMinPurchases', label: 'Lately min purchases' },
    ],
    toggles: [
      { key: 'labelClusterDownweight', label: 'Down-weight label-cluster twins' },
      { key: 'ignoreCompilations', label: 'Ignore compilations' },
    ],
  },
  {
    title: 'Lately re-reads',
    fields: [
      { key: 'latelyRescanTwins', label: 'Top lately twins (0 = off)' },
      { key: 'latelyRescanDays', label: 'Every (days)' },
    ],
  },
];

type ReadyView = Extract<ReturnType<typeof useSettings>['view'], { state: 'ready' }>;

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

/** Scanner pace, caps and twins thresholds, validated, with a reset to the defaults. */
export function SettingsPanel() {
  const { view, setField, save, reset } = useSettings();

  if (view.state === 'loading') return <EmptyState title="Loading settings…" />;
  if (view.state === 'error') {
    return <EmptyState tone="error" title="Couldn't load settings" description={view.error} />;
  }

  const { draft, errors, dirty, saveState } = view;
  const invalid = Object.keys(errors).length > 0;
  const setNumber = (key: NumericSetting) => (value: number) =>
    setField(key, value as Settings[typeof key]);

  return (
    <form
      className="dh-settings"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {GROUPS.map((group) => (
        <fieldset key={group.title} className="dh-settings__group">
          <legend className="dh-settings__legend">{group.title}</legend>
          <div className="dh-settings__fields">
            {group.fields.map(({ key, label }) => (
              <NumberField
                key={key}
                label={label}
                value={draft[key]}
                onChange={setNumber(key)}
                error={errors[key]}
                min={SETTING_LIMITS[key].min}
                max={SETTING_LIMITS[key].max}
              />
            ))}
          </div>
          {group.toggles?.map(({ key, label }) => (
            <Toggle
              key={key}
              label={label}
              checked={draft[key]}
              onChange={(checked) => setField(key, checked)}
            />
          ))}
        </fieldset>
      ))}
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
