export type FieldErrors = Record<string, string | undefined>;

export type Check = string | undefined;

/** Returns the first non-empty message among the checks. */
export function first(...checks: Check[]): Check {
  return checks.find(Boolean);
}

export function required(value: string, label: string): Check {
  return value.trim() ? undefined : `${label} is required`;
}

export function email(value: string): Check {
  const v = value.trim();
  if (!v) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    ? undefined
    : "Enter a valid email address";
}

export function minLength(value: string, min: number, label: string): Check {
  if (!value) return undefined;
  return value.length >= min
    ? undefined
    : `${label} must be at least ${min} characters`;
}

export function pattern(value: string, regex: RegExp, message: string): Check {
  if (!value) return undefined;
  return regex.test(value) ? undefined : message;
}

export function match(
  value: string,
  other: string,
  message = "Passwords don't match",
): Check {
  return value === other ? undefined : message;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}
