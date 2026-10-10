"use client";

import {
  clear,
  createStore,
  del,
  entries as idbEntries,
  get,
  set,
} from "idb-keyval";

/**
 * Meal photos (JPEG data URLs) keyed by entry id, kept in IndexedDB so they
 * don't eat into localStorage's ~5 MB quota. Everything is mirrored in memory
 * so components can read photos synchronously once `ready` is true.
 */

const photos = new Map<string, string>();
const listeners = new Set<() => void>();
/** Ids already looked up by ensurePhotos, so each is fetched only once. */
const pending = new Set<string>();
let ready = false;
let version = 0;

let db: ReturnType<typeof createStore> | null = null;
function store() {
  db ??= createStore("calapp-photos", "photos");
  return db;
}

function emit() {
  version++;
  listeners.forEach((l) => l());
}

let loading: Promise<void> | null = null;
export function loadPhotos() {
  loading ??= idbEntries<string, string>(store())
    .then((rows) => rows.forEach(([id, url]) => photos.set(id, url)))
    .catch((err) => console.error("Failed to load photos", err))
    .finally(() => {
      ready = true;
      emit();
    });
  return loading;
}

export const isReady = () => ready;
/** Bumps on every change, for memoizing derived snapshots. */
export const photosVersion = () => version;
export const getPhoto = (id: string) => photos.get(id);

export function subscribePhotos(listener: () => void) {
  listeners.add(listener);
  void loadPhotos();
  return () => listeners.delete(listener);
}

/**
 * Updates memory immediately (without notifying, so the caller's own write
 * triggers the render) and resolves once IndexedDB has the photo.
 */
export async function putPhoto(id: string, dataUrl: string) {
  if (photos.get(id) === dataUrl) return;
  photos.set(id, dataUrl);
  version++;
  await set(id, dataUrl, store());
}

export async function removePhoto(id: string) {
  if (photos.delete(id)) emit();
  await del(id, store());
}

export async function clearPhotos() {
  photos.clear();
  pending.clear();
  emit();
  await clear(store());
}

/** Fetch photos written by another tab after the initial load. */
export function ensurePhotos(ids: string[]) {
  if (!ready) return;
  for (const id of ids) {
    if (photos.has(id) || pending.has(id)) continue;
    pending.add(id);
    get<string>(id, store())
      .then((url) => {
        if (url) {
          photos.set(id, url);
          emit();
        }
      })
      .catch(() => {});
  }
}
