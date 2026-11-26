import { useEffect, useState } from 'react';

export const fontSizes = ['100', '110', '125'] as const;
type FontSize = typeof fontSizes[number];

export interface Preferences {
  fontSize: FontSize;
  fullDescriptions: boolean;
  filtersInDialog: boolean;
}

const defaults: Preferences = { fontSize: '100', fullDescriptions: false, filtersInDialog: false };
const storageKey = 'sprint-board-preferences';

function readPreferences(): Preferences {
  try {
    const stored: (Partial<Preferences> & { hideFilters?: boolean }) | null = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    return {
      fontSize: fontSizes.find((value) => value === stored?.fontSize) ?? defaults.fontSize,
      fullDescriptions: stored?.fullDescriptions === true,
      filtersInDialog: (stored?.filtersInDialog ?? stored?.hideFilters) === true,
    };
  } catch {
    return defaults;
  }
}

export function usePreferences() {
  const [preferences, setPreferences] = useState(readPreferences);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fontSize = preferences.fontSize;
    root.dataset.fullDescriptions = String(preferences.fullDescriptions);
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
      // The current session still keeps its settings when storage is unavailable.
    }
  }, [preferences]);
  return { preferences, setPreferences };
}
