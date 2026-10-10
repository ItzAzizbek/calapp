"use client";

import { useSyncExternalStore } from "react";
import { doc, table } from "./db";
import {
  clearPhotos,
  ensurePhotos,
  getPhoto,
  isReady as photosReady,
  loadPhotos,
  photosVersion,
  putPhoto,
  removePhoto,
  subscribePhotos,
} from "./photos";
import type { Entry, Goals, Profile } from "./types";
import { DEFAULT_GOALS } from "./utils";

/* ---------- Collections (localStorage + IndexedDB for photos) ---------- */

/** An entry as stored in localStorage: the photo lives in IndexedDB. */
type StoredEntry = Omit<Entry, "image"> & {
  hasImage?: boolean;
  /** Inline photo written by an earlier version; moved out on migration. */
  image?: string;
};

const entries = table<StoredEntry>("entries", {
  sort: (a, b) => a.eatenAt - b.eatenAt,
});

const goals = doc<Goals>("goals", DEFAULT_GOALS, (raw) => ({
  ...DEFAULT_GOALS,
  ...(raw as Partial<Goals>),
}));

const profile = doc<Profile | null>("profile", null);

/* ---------- Hydration ---------- */

const noop = () => () => {};

/** False during SSR and hydration, true once running in the browser. */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/* ---------- Entries ---------- */

const NO_ENTRIES: Entry[] = [];

let merged: Entry[] = NO_ENTRIES;
let mergedRows: StoredEntry[] | null = null;
let mergedVersion = -1;

/** Rows joined with their photos; stable until either side changes. */
function entriesSnapshot(): Entry[] {
  const rows = entries.rows();
  const version = photosVersion();
  if (rows === mergedRows && version === mergedVersion) return merged;
  mergedRows = rows;
  mergedVersion = version;
  merged = rows.map(({ hasImage, image, ...row }) => {
    const photo = hasImage ? getPhoto(row.id) : image;
    return photo ? { ...row, image: photo } : row;
  });
  ensurePhotos(rows.filter((r) => r.hasImage).map((r) => r.id));
  return merged;
}

function subscribeEntries(listener: () => void) {
  const offRows = entries.subscribe(listener);
  const offPhotos = subscribePhotos(listener);
  return () => {
    offRows();
    offPhotos();
  };
}

export function useEntries() {
  return useSyncExternalStore(
    subscribeEntries,
    entriesSnapshot,
    () => NO_ENTRIES,
  );
}

/** True once photos have loaded from IndexedDB (or failed to). */
export function usePhotosReady() {
  return useSyncExternalStore(subscribePhotos, photosReady, () => false);
}

function toRow({ image, ...row }: Entry): StoredEntry {
  return image ? { ...row, hasImage: true } : row;
}

function persistPhoto({ id, image }: Entry) {
  return image ? putPhoto(id, image) : removePhoto(id);
}

/**
 * The row is written synchronously (throws StorageError on failure); the
 * returned promise rejects if the photo couldn't be written to IndexedDB.
 */
export function saveEntry(entry: Entry): Promise<void> {
  const photo = persistPhoto(entry); // memory first, so the row renders with it
  entries.put(toRow(entry));
  return photo;
}

export function saveEntries(list: Entry[]): Promise<void> {
  const photos = Promise.all(list.map(persistPhoto));
  entries.putMany(list.map(toRow));
  return photos.then(() => {});
}

export function deleteEntry(id: string): Promise<void> {
  entries.remove(id);
  return removePhoto(id);
}

export function deleteAllEntries(): Promise<void> {
  entries.clear();
  return clearPhotos();
}

/* ---------- Goals ---------- */

export function useGoals() {
  return useSyncExternalStore(goals.subscribe, goals.get, () => DEFAULT_GOALS);
}

export const saveGoals = (next: Goals) => goals.set(next);

/* ---------- Profile ---------- */

export function useProfile() {
  return useSyncExternalStore(profile.subscribe, profile.get, () => null);
}

export const saveProfile = (next: Profile) => profile.set(next);

/* ---------- Migration ---------- */

const migrated = doc<boolean>("idb-migrated", false);
let migrating: Promise<void> | null = null;

/**
 * - The first version kept meals in IndexedDB ("calapp" database) and goals
 *   under `calapp:goals` (which `doc("goals")` already reads). Copy those
 *   meals over once, then drop the old database.
 * - The next version kept photos inline in localStorage rows. Move them out
 *   to the photo store.
 */
export function migrateLegacyStorage() {
  migrating ??= (async () => {
    await loadPhotos();
    const inline = entries.rows().filter((r) => r.image && !r.hasImage);
    for (const row of inline) {
      await putPhoto(row.id, row.image!);
      entries.put(toRow(row as Entry));
    }

    if (migrated.get() || typeof indexedDB === "undefined") return;
    if (typeof indexedDB.databases !== "function") return;
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === "calapp")) return;

    const idb = await import("idb-keyval");
    const rows = await idb.entries<string, Entry>(
      idb.createStore("calapp", "entries"),
    );
    const missing = rows
      .map(([, e]) => e)
      .filter((e) => e?.id && !entries.get(e.id));
    await saveEntries(missing);
    migrated.set(true);
    indexedDB.deleteDatabase("calapp");
  })().catch((err) => console.error("Failed to migrate old meals", err));
  return migrating;
}
