"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Camera,
  House,
  ImagePlus,
  Images,
  PenLine,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StorageError } from "@/lib/db";
import {
  deleteAllEntries,
  deleteEntry,
  migrateLegacyStorage,
  saveEntries,
  saveEntry,
  saveGoals,
  saveProfile,
  useEntries,
  useGoals,
  useHydrated,
  usePhotosReady,
  useProfile,
} from "@/lib/store";
import { MEAL_TYPES, type Entry, type Goals, type Profile } from "@/lib/types";
import {
  cn,
  dayKey,
  daySubtitle,
  dayTitle,
  entryTotals,
  sumEntries,
} from "@/lib/utils";
import { MealEditor, type EditorMode } from "./MealEditor";
import { MealList } from "./MealList";
import { Onboarding } from "./Onboarding";
import { SettingsSheet } from "./SettingsSheet";
import { Summary } from "./Summary";
import { Toast, type ToastData } from "./Toast";
import { WeekStrip } from "./WeekStrip";

/** Current local day; rolls over at midnight and when the tab regains focus. */
function useToday() {
  const [today, setToday] = useState(() => dayKey());
  useEffect(() => {
    const tick = () => setToday(dayKey());
    const interval = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return today;
}

export function App() {
  const hydrated = useHydrated();
  const photosReady = usePhotosReady();
  const profile = useProfile();
  const [redoSetup, setRedoSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void migrateLegacyStorage();
  }, []);

  // Everything date-dependent renders client-side only, once local data loads.
  if (!hydrated || !photosReady) {
    return (
      <Shell>
        <LoadingState />
        <NavBar
          disabled
          onToday={noop}
          onPhotos={noop}
          onSnap={noop}
          onDescribe={noop}
          onSettings={noop}
        />
      </Shell>
    );
  }

  const onboarding = !profile || redoSetup;
  const finishSetup = (next: Omit<Profile, "onboardedAt">, goals: Goals) => {
    try {
      saveGoals(goals);
      saveProfile({ ...next, onboardedAt: Date.now() });
      setRedoSetup(false);
      setError(null);
    } catch (err) {
      setError(storageMessage(err));
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {onboarding ? (
        // Opacity only: transforms and filters would re-anchor the
        // position:fixed bars inside to this wrapper mid-animation.
        <motion.div
          key="onboarding"
          className="flex flex-1 flex-col"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Onboarding
            initial={profile}
            onDone={finishSetup}
            onCancel={profile ? () => setRedoSetup(false) : undefined}
          />
          <Toast
            toast={error ? { id: 0, message: error } : null}
            onDismiss={() => setError(null)}
          />
        </motion.div>
      ) : (
        <motion.div
          key="dashboard"
          className="flex flex-1 flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
        >
          <Dashboard profile={profile} onRedoSetup={() => setRedoSetup(true)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function storageMessage(err: unknown) {
  return err instanceof StorageError
    ? err.message
    : "Couldn't save to this device's storage";
}

function greeting(name: string) {
  const h = new Date().getHours();
  const part =
    h < 5
      ? "Hey"
      : h < 12
        ? "Good morning"
        : h < 18
          ? "Good afternoon"
          : "Good evening";
  return `${part}, ${name}`;
}

const noop = () => {};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10">
      {children}
    </div>
  );
}

interface NavBarProps {
  disabled?: boolean;
  /** Which tab to highlight. */
  active?: "today" | "settings" | null;
  onToday: () => void;
  onPhotos: () => void;
  onSnap: () => void;
  onDescribe: () => void;
  onSettings: () => void;
}

function NavBar({
  disabled,
  active = null,
  onToday,
  onPhotos,
  onSnap,
  onDescribe,
  onSettings,
}: NavBarProps) {
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {/* Frosted glass pill: translucent fill, blur + saturation boost,
          a bright top edge and a soft drop shadow so it floats. */}
      <div className="pointer-events-auto relative grid h-[68px] w-full max-w-[400px] grid-cols-5 items-center rounded-[30px] border border-white/70 bg-gradient-to-b from-white/70 to-white/35 px-1.5 shadow-[0_18px_40px_-12px_rgb(0_0_0/0.28),0_2px_8px_rgb(0_0_0/0.06),inset_0_1px_0_rgb(255_255_255/0.9),inset_0_-1px_0_rgb(0_0_0/0.04)] backdrop-blur-2xl backdrop-saturate-[1.8]">
        <NavItem
          icon={House}
          label="Today"
          active={active === "today"}
          disabled={disabled}
          onClick={onToday}
        />
        <NavItem
          icon={Images}
          label="Photos"
          disabled={disabled}
          onClick={onPhotos}
        />
        <div className="grid place-items-center">
          <motion.button
            type="button"
            onClick={onSnap}
            disabled={disabled}
            aria-label="Snap a meal"
            title="Snap a meal"
            whileHover={disabled ? undefined : { scale: 1.06 }}
            whileTap={disabled ? undefined : { scale: 0.92 }}
            className="relative grid size-[54px] place-items-center overflow-hidden rounded-full bg-gradient-to-b from-neutral-700 to-black text-white shadow-[0_8px_20px_-6px_rgb(0_0_0/0.55),inset_0_1px_0_rgb(255_255_255/0.25)] disabled:opacity-50"
          >
            <span
              aria-hidden
              className="absolute inset-x-2 top-0.5 h-1/2 rounded-full bg-gradient-to-b from-white/25 to-transparent"
            />
            <Camera className="relative size-[22px]" strokeWidth={2.1} />
          </motion.button>
        </div>
        <NavItem
          icon={PenLine}
          label="Describe"
          disabled={disabled}
          onClick={onDescribe}
        />
        <NavItem
          icon={Settings}
          label="Settings"
          active={active === "settings"}
          disabled={disabled}
          onClick={onSettings}
        />
      </div>
    </nav>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      className={cn(
        "relative flex h-[56px] flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium transition-colors disabled:opacity-50",
        active ? "text-fg" : "text-muted enabled:hover:text-fg",
      )}
    >
      {active && (
        // A small glass "bubble" that glides between active tabs.
        <motion.span
          layoutId="nav-active"
          aria-hidden
          className="absolute inset-x-0.5 inset-y-0 rounded-[22px] border border-white/80 bg-white/70 shadow-[0_4px_14px_-6px_rgb(0_0_0/0.25),inset_0_1px_0_rgb(255_255_255)]"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <Icon className="relative size-[21px]" strokeWidth={active ? 2.3 : 1.9} />
      <span className="relative">{label}</span>
    </motion.button>
  );
}

function Dashboard({
  profile,
  onRedoSetup,
}: {
  profile: Profile;
  onRedoSetup: () => void;
}) {
  const entries = useEntries();
  const goals = useGoals();
  const today = useToday();

  const [selected, setSelected] = useState(today);
  // Follow the calendar when the day rolls over while viewing "today".
  const [prevToday, setPrevToday] = useState(today);
  if (today !== prevToday) {
    setPrevToday(today);
    if (selected === prevToday) setSelected(today);
  }

  const [editor, setEditor] = useState<{
    key: number;
    mode: EditorMode;
    open: boolean;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((t: Omit<ToastData, "id">) => {
    setToast({ ...t, id: Date.now() });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const dayEntries = useMemo(
    () => entries.filter((e) => e.day === selected),
    [entries, selected],
  );
  const totals = useMemo(() => sumEntries(dayEntries), [dayEntries]);
  const caloriesByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      map.set(e.day, (map.get(e.day) ?? 0) + entryTotals(e).calories);
    }
    return map;
  }, [entries]);

  const openEditor = useCallback((mode: EditorMode) => {
    setEditor((prev) => ({ key: (prev?.key ?? 0) + 1, mode, open: true }));
  }, []);
  const closeEditor = useCallback(
    () => setEditor((prev) => (prev ? { ...prev, open: false } : prev)),
    [],
  );

  const anySheetOpen = !!editor?.open || settingsOpen;
  const sheetOpenRef = useRef(anySheetOpen);
  useEffect(() => {
    sheetOpenRef.current = anySheetOpen;
  });

  const openPhoto = useCallback(
    (file: Blob) => openEditor({ kind: "photo", file }),
    [openEditor],
  );

  // Drag & drop and paste anywhere on the page.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e) || sheetOpenRef.current) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e) || sheetOpenRef.current) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (sheetOpenRef.current) return;
      const file = Array.from(e.dataTransfer?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (file) openPhoto(file);
      else showToast({ message: "Drop an image file" });
    };
    const onPaste = (e: ClipboardEvent) => {
      if (sheetOpenRef.current) return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (file) {
        e.preventDefault();
        openPhoto(file);
      }
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [openPhoto, showToast]);

  /**
   * Run a storage write; returns false (and tells the user) if the meal
   * couldn't be saved. Photo writes finish later and report on their own.
   */
  const persist = (write: () => void | Promise<void>) => {
    try {
      write()?.catch(() =>
        showToast({ message: "Couldn't save the photo to this device" }),
      );
      return true;
    } catch (err) {
      showToast({ message: storageMessage(err) });
      return false;
    }
  };

  const handleSave = (entry: Entry, isNew: boolean) => {
    // Keep the editor open on failure so the meal isn't lost.
    if (!persist(() => saveEntry(entry))) return;
    closeEditor();
    const label = MEAL_TYPES.find((t) => t.id === entry.mealType)?.label;
    showToast({
      message: isNew ? `Added to ${label?.toLowerCase()}` : "Changes saved",
    });
  };

  const handleDelete = (entry: Entry) => {
    persist(() => deleteEntry(entry.id));
    closeEditor();
    showToast({
      message: "Meal deleted",
      action: { label: "Undo", onClick: () => persist(() => saveEntry(entry)) },
    });
  };

  const handleDeleteAll = () => {
    const backup = entries;
    persist(deleteAllEntries);
    setSettingsOpen(false);
    showToast({
      message: "All meals deleted",
      action: {
        label: "Undo",
        onClick: () => persist(() => saveEntries(backup)),
      },
    });
  };

  const isToday = selected === today;

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) openPhoto(file);
  };

  return (
    <Shell>
      <header className="flex items-start justify-between gap-4 px-1">
        <div className="min-w-0">
          {profile.name && isToday && (
            <p className="mb-0.5 text-[15px] font-medium text-muted">
              {greeting(profile.name)}
            </p>
          )}
          <h1 className="text-[32px] leading-tight font-semibold tracking-[-0.03em]">
            {dayTitle(selected, today)}
          </h1>
          <p className="mt-0.5 flex items-center gap-2 text-[15px] text-muted">
            {daySubtitle(selected)}
            <AnimatePresence>
              {!isToday && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setSelected(today)}
                  className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-3"
                >
                  Today
                </motion.button>
              )}
            </AnimatePresence>
          </p>
        </div>
      </header>

      <div className="mt-5">
        <WeekStrip
          selected={selected}
          today={today}
          caloriesByDay={caloriesByDay}
          goal={goals.calories}
          onSelect={setSelected}
        />
      </div>

      <div className="mt-5">
        <Summary totals={totals} goals={goals} />
      </div>

      <main className="mt-8">
        <h2 className="sr-only">Meals</h2>
        {dayEntries.length > 0 ? (
          <MealList
            entries={dayEntries}
            onOpen={(entry) => openEditor({ kind: "edit", entry })}
          />
        ) : (
          <EmptyState isToday={isToday} />
        )}
      </main>

      <NavBar
        active={settingsOpen ? "settings" : isToday ? "today" : null}
        onToday={() => {
          setSelected(today);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        onPhotos={() => fileRef.current?.click()}
        onSnap={() => cameraRef.current?.click()}
        onDescribe={() => openEditor({ kind: "describe" })}
        onSettings={() => setSettingsOpen(true)}
      />

      {/* Library picker, and a camera-first picker (phones open the camera). */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={onPickFile}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={onPickFile}
      />

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-bg/80 p-6 backdrop-blur-sm"
          >
            <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-[32px] border-2 border-dashed border-fg/25 px-6 py-16 text-center">
              <ImagePlus className="size-8" />
              <p className="text-lg font-semibold">Drop to analyze</p>
              <p className="text-[15px] text-muted">
                We&apos;ll estimate calories and macros from the photo.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {editor && (
        <MealEditor
          key={editor.key}
          open={editor.open}
          mode={editor.mode}
          day={selected}
          onClose={closeEditor}
          onSave={handleSave}
          onDelete={handleDelete}
          onPickPhoto={() => {
            closeEditor();
            fileRef.current?.click();
          }}
        />
      )}

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        goals={goals}
        onSave={(next) => persist(() => saveGoals(next))}
        entries={entries}
        onDeleteAll={handleDeleteAll}
        profile={profile}
        onRedoSetup={() => {
          setSettingsOpen(false);
          onRedoSetup();
        }}
      />

      <Toast toast={toast} onDismiss={dismissToast} />
    </Shell>
  );
}

function EmptyState({ isToday }: { isToday: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-surface shadow-card">
        <Camera className="size-6 text-muted" />
      </div>
      <p className="mt-5 text-[17px] font-semibold">
        {isToday ? "Nothing logged yet" : "Nothing logged this day"}
      </p>
      <p className="mt-1.5 max-w-[280px] text-[15px] leading-relaxed text-muted">
        Snap a photo of your plate and we&apos;ll estimate the calories for you.
      </p>
      <p className="mt-4 hidden text-[13px] text-faint sm:block">
        Tip: drop or paste an image anywhere
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-5">
      <div className="flex items-start justify-between px-1">
        <div className="flex flex-col gap-2">
          <div className="skeleton h-9 w-32 rounded-lg" />
          <div className="skeleton h-5 w-24 rounded-md" />
        </div>
      </div>
      <div className="skeleton h-[84px] rounded-2xl" />
      <div className="skeleton h-[300px] rounded-[28px]" />
    </div>
  );
}
