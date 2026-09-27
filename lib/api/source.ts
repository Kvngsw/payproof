"use client";

import { useSyncExternalStore } from "react";

export type DataSource = "mock" | "live";

const SOURCE_KEY = "pp_source";
const TOKEN_PREFIX = "pp_token_";
const LEGACY_TOKEN_KEY = "pp_token";

// Deployed default is the real backend; local .env.local pins "mock".
const DEFAULT_SOURCE: DataSource =
  process.env.NEXT_PUBLIC_DEFAULT_SOURCE === "mock" ? "mock" : "live";

let current: DataSource | null = null;
const listeners = new Set<() => void>();

function readStored(): DataSource {
  if (typeof window === "undefined") return DEFAULT_SOURCE;
  try {
    const value = localStorage.getItem(SOURCE_KEY);
    if (value === "mock" || value === "live") return value;
  } catch {}
  return DEFAULT_SOURCE;
}

export function getDataSource(): DataSource {
  if (current === null) current = readStored();
  return current;
}

export function setDataSource(source: DataSource) {
  if (typeof window === "undefined") return;
  current = source;
  try {
    localStorage.setItem(SOURCE_KEY, source);
  } catch {}
  listeners.forEach((listener) => listener());
}

function subscribeSource(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function useDataSource(): DataSource {
  return useSyncExternalStore(
    subscribeSource,
    getDataSource,
    () => DEFAULT_SOURCE,
  );
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const namespaced = TOKEN_PREFIX + getDataSource();
  try {
    const token = localStorage.getItem(namespaced);
    if (token) return token;
    const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacy) {
      localStorage.setItem(namespaced, legacy);
      localStorage.removeItem(LEGACY_TOKEN_KEY);
      return legacy;
    }
  } catch {}
  return null;
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKEN_PREFIX + getDataSource(), token);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {}
}

export function clearToken() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOKEN_PREFIX + getDataSource());
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {}
}
