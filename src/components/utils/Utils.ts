import type {BaseOption} from "../../types";

export function getLabel<T extends BaseOption>(
  option: T,
  labelKey: string,
  getOptionLabel?: (option: T) => string
): string {
  return getOptionLabel ? getOptionLabel(option) : option[labelKey];
}

export function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

export function isURL(str: string): boolean {
  return str.startsWith("https://") || str.startsWith("http://");
}

export function sanitizeArray<T>(arr: T | readonly T[] | null | undefined): T[] {
  return arr ? (Array.isArray(arr) ? (arr as T[]) : [arr as T]) : [];
}

export function arraysAreEqual<T>(a: readonly T[] | null | undefined, b: readonly T[] | null | undefined): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function monotonicAssign<T extends object>(target: T, ...sources: Partial<T>[]): T {
  // Note that this does not handle empty arrays, only attributes with explicitly undefined values
  return Object.assign(
    target,
    ...sources.map((x) => Object.fromEntries(Object.entries(x).filter(([key, value]) => value !== undefined)))
  );
}

/**
 * Compares lists of options by comparing the specified {@code valueKey}s
 *
 * @param a first option list
 * @param b second option list
 * @param valueKey the key in option objects to compare
 * @returns {boolean} {@code true} if both lists contain options with matching values of {@code valueKey} in the same order
 */
export function optionListsAreEqual<T extends BaseOption>(
  a: readonly (T | string | number)[] | null | undefined,
  b: readonly (T | string | number)[] | null | undefined,
  valueKey: string
): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    const keyA = (a[i] as T)?.[valueKey] ?? a[i];
    const keyB = (b[i] as T)?.[valueKey] ?? b[i];
    if (keyA !== keyB) return false;
  }
  return true;
}
