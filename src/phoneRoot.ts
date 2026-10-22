/**
 * OK-RN'S APP AS A ROOT (PhoneApp.tsx, a copy of ok-rn's App.tsx), behind ok-rn's start-up guard -
 * the phone's root (entry.android.ts) and the desktop's (entry.ts, on Electron).
 */
import React from 'react';
import { startupFailure, StartupBoundary } from './StartupFailure';

/*
 * App is required inside a guard, not imported: an error while its modules load
 * (a native module this APK lacks) would otherwise leave the launch splash up
 * forever with nothing to read. See src/StartupFailure.tsx.
 */
export function phoneRoot(): React.ComponentType {
  try {
    const App = require('../PhoneApp').default;
    return function GuardedApp() {
      return React.createElement(StartupBoundary, null, React.createElement(App));
    };
  } catch (e) {
    return startupFailure(e, 'loading the app');
  }
}
