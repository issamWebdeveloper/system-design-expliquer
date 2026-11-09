"use client";

import { useEffect, useSyncExternalStore } from "react";

const VISITED_STORAGE_KEY = "visited-systems";
const VISITED_CHANGE_EVENT = "sde:visited-change";
const EMPTY = "[]";

function readRaw(): string {
  try {
    return localStorage.getItem(VISITED_STORAGE_KEY) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function parse(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(VISITED_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(VISITED_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Slugs of systems this browser has opened. Empty on the server and before hydration. */
export function useVisitedSystems(): string[] {
  // Subscribe to the raw string so the snapshot is stable between renders.
  const raw = useSyncExternalStore(subscribe, readRaw, () => EMPTY);
  return parse(raw);
}

/** Records a visit to a system page. */
export function useRecordVisit(slug: string) {
  useEffect(() => {
    const visited = parse(readRaw());
    if (visited.includes(slug)) return;
    try {
      localStorage.setItem(VISITED_STORAGE_KEY, JSON.stringify([...visited, slug]));
    } catch {
      // Storage unavailable: progress simply isn't remembered.
    }
    window.dispatchEvent(new Event(VISITED_CHANGE_EVENT));
  }, [slug]);
}
