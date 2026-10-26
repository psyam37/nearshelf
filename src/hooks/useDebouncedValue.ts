import { useEffect, useState } from "react";

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
  // 1. Create a local state to hold the stable, delayed value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 2. Set up a timer to update our local state after the delay
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    // 3. CLEANUP: If the user types another letter before the delay ends,
    // this cleanup function runs, clearing the old timer and restarting the clock.
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]); // Re-run this effect whenever the raw value or delay changes

  // 4. Return the stable value that only updates after a pause
  return debouncedValue;
}
