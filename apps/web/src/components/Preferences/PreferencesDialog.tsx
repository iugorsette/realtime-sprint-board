import { fontSizes, type Preferences } from '../../board/preferences';
import { BoardDialog } from '../BoardDialog/BoardDialog';
import styles from './PreferencesDialog.module.css';

const sizeLabels = { '100': 'Small', '110': 'Medium', '125': 'Large' } as const;

function Toggle({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.toggle}>
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className={styles.track} aria-hidden="true" />
    </label>
  );
}

export function PreferencesDialog({ value, onChange, onClose }: {
  value: Preferences;
  onChange: (preferences: Preferences) => void;
  onClose: () => void;
}) {
  return (
    <BoardDialog title="Preferences" onClose={onClose}>
      <fieldset className={styles.fontSize}>
        <legend>Text size</legend>
        <div>
          {fontSizes.map((size) => (
            <label key={size} data-size={size}>
              <input type="radio" name="font-size" checked={size === value.fontSize}
                onChange={() => onChange({ ...value, fontSize: size })} />
              <span className={styles.sample} aria-hidden="true">A</span>
              <span>{sizeLabels[size]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Toggle label="Show full card descriptions" checked={value.fullDescriptions}
        onChange={(fullDescriptions) => onChange({ ...value, fullDescriptions })} />
      <Toggle label="Open filters in a dialog" checked={value.filtersInDialog}
        onChange={(filtersInDialog) => onChange({ ...value, filtersInDialog })} />
    </BoardDialog>
  );
}
