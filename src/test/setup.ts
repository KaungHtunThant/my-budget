/**
 * Vitest global setup.
 *
 * jsdom ships no IndexedDB, so `fake-indexeddb/auto` installs an in-process implementation on
 * the global object. That lets the repository contract suite run the real Dexie code path
 * under Node — the same code that runs in the Android webview — rather than a stand-in.
 */

import 'fake-indexeddb/auto'
