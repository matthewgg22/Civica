// Minimal next-intl stub for Storybook.
// useTranslations returns the key as-is (sufficient for visual stories).
export function useTranslations(_namespace?: string) {
  return function t(key: string, _values?: Record<string, unknown>): string {
    return key;
  };
}

export function getTranslations(_opts?: unknown) {
  return Promise.resolve(function t(key: string): string {
    return key;
  });
}
