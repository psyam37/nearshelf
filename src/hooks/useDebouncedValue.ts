/**
 * Returns `value`, but only once it has stopped changing for `delayMs`.
 *
 * While someone types "amoxicillin", the search box changes 11 times. We only
 * want to search once they pause, so the component searches with the
 * debounced value instead of the raw one.
 *
 * `<T>` makes this generic: pass a string and you get a string back, pass a
 * number and you get a number back.
 */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  // TODO (your turn): this returns `value` straight away, so the search runs
  // on every key press. Make it wait for `delayMs`. Steps are in the chat.
  void delayMs; // delete this line once you use delayMs
  return value;
}
