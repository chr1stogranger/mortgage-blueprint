import { Capacitor } from '@capacitor/core';

// iOS/Android status bar text has to contrast with the app's ground:
// Style.Dark = light text (dark mode), Style.Light = dark text (light mode,
// the default since 2026-05). It used to be hard-coded to Style.Dark, which
// left the clock and battery white-on-white in light mode (found 2026-10-18).
export function syncNativeStatusBar(dark) {
  if (!Capacitor.isNativePlatform()) return;
  import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }))
    .catch(() => { /* plugin unavailable */ });
}
