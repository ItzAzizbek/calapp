"use client";

/**
 * A tiny localStorage-backed database.
 *
 * - `table()` keeps one row per key (`calapp:<name>:<id>`), so a write only
 *   re-serializes the row that changed.
 * - `doc()` keeps a single JSON value under one key.
 *
 * Both hold an in-memory snapshot for useSyncExternalStore, write through to
 * localStorage synchronously (so a failed write never shows up in the UI), and
 * pick up changes made in other tabs via the `storage` event.
 */

const PREFIX = "calapp:";

export class StorageError extends Error {
  constructor(public full: boolean) {
    super(
      full
        ? "This device's storage is full. Export and delete old meals to free up space."
        : "Couldn't save to this device's storage.",
    );
  }
}

function ls(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (e.g. some privacy modes)
  }
}

function isQuotaError(err: unknown) {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" ||
      err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      err.code === 22)
  );
}

function writeRaw(key: string, value: unknown) {
  const storage = ls();
  if (!storage) throw new StorageError(false);
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (err) {
    throw new StorageError(isQuotaError(err));
  }
}

function readRaw(key: string): unknown {
  const raw = ls()?.getItem(key);
  if (raw == null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/* ---------- Cross-tab sync ---------- */

const storageHandlers = new Set<(e: StorageEvent) => void>();
let listening = false;
function onStorage(handler: (e: StorageEvent) => void) {
  storageHandlers.add(handler);
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("storage", (e) => {
      if (e.storageArea !== ls()) return;
      if (e.key !== null && !e.key.startsWith(PREFIX)) return;
      storageHandlers.forEach((h) => h(e));
    });
  }
}

/* ---------- Tables ---------- */

export interface Table<T extends { id: string }> {
  /** All rows, sorted. Stable reference until the table changes. */
  rows(): T[];
  get(id: string): T | undefined;
  /** Insert or replace. Throws StorageError if the write fails. */
  put(row: T): void;
  putMany(rows: T[]): void;
  remove(id: string): void;
  clear(): void;
  subscribe(listener: () => void): () => void;
}

export function table<T extends { id: string }>(
  name: string,
  options: { sort?: (a: T, b: T) => number } = {},
): Table<T> {
  const keyPrefix = `${PREFIX}${name}:`;
  const map = new Map<string, T>();
  const listeners = new Set<() => void>();
  let snapshot: T[] = [];
  let loaded = false;

  const rebuild = () => {
    const list = [...map.values()];
    snapshot = options.sort ? list.sort(options.sort) : list;
    listeners.forEach((l) => l());
  };

  const load = () => {
    if (loaded) return;
    const storage = ls();
    if (!storage) return;
    loaded = true;
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(keyPrefix)) continue;
      const row = readRaw(key) as T | undefined;
      if (row && typeof row === "object") map.set(row.id, row);
    }
    const list = [...map.values()];
    snapshot = options.sort ? list.sort(options.sort) : list;

    onStorage((e) => {
      if (e.key === null) {
        map.clear();
        loaded = false;
        load();
        listeners.forEach((l) => l());
        return;
      }
      if (!e.key.startsWith(keyPrefix)) return;
      const id = e.key.slice(keyPrefix.length);
      const row = e.newValue ? (readRaw(e.key) as T | undefined) : undefined;
      if (row) map.set(id, row);
      else map.delete(id);
      rebuild();
    });
  };

  return {
    rows() {
      load();
      return snapshot;
    },
    get(id) {
      load();
      return map.get(id);
    },
    put(row) {
      load();
      writeRaw(keyPrefix + row.id, row);
      map.set(row.id, row);
      rebuild();
    },
    putMany(rows) {
      load();
      try {
        for (const row of rows) {
          writeRaw(keyPrefix + row.id, row);
          map.set(row.id, row);
        }
      } finally {
        rebuild();
      }
    },
    remove(id) {
      load();
      ls()?.removeItem(keyPrefix + id);
      map.delete(id);
      rebuild();
    },
    clear() {
      load();
      for (const id of map.keys()) ls()?.removeItem(keyPrefix + id);
      map.clear();
      rebuild();
    },
    subscribe(listener) {
      load();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/* ---------- Documents ---------- */

export interface Doc<T> {
  get(): T;
  /** Throws StorageError if the write fails. */
  set(value: T): void;
  remove(): void;
  subscribe(listener: () => void): () => void;
}

export function doc<T>(
  name: string,
  fallback: T,
  /** Normalize stored data, e.g. to fill in fields added later. */
  parse: (raw: unknown) => T = (raw) => raw as T,
): Doc<T> {
  const key = PREFIX + name;
  const listeners = new Set<() => void>();
  let value = fallback;
  let loaded = false;

  const read = () => {
    const raw = readRaw(key);
    value = raw === undefined ? fallback : parse(raw);
  };

  const load = () => {
    if (loaded || !ls()) return;
    loaded = true;
    read();
    onStorage((e) => {
      if (e.key !== null && e.key !== key) return;
      read();
      listeners.forEach((l) => l());
    });
  };

  return {
    get() {
      load();
      return value;
    },
    set(next) {
      load();
      writeRaw(key, next);
      value = next;
      listeners.forEach((l) => l());
    },
    remove() {
      load();
      ls()?.removeItem(key);
      value = fallback;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      load();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
