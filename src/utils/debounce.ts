/**
 * Debounce and Throttle utilities — Pure functions, no dependencies.
 */

/**
 * Returns a debounced version of `fn` that delays invoking it until `ms`
 * milliseconds have elapsed since the last call.
 *
 * @example
 * const debouncedSearch = debounce(searchApi, 300);
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value));
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = function (this: any, ...args: Parameters<T>) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = undefined;
    }, ms);
  } as T & { cancel: () => void };

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  return debounced;
}

/**
 * Returns a throttled version of `fn` that invokes it at most once per `ms`
 * milliseconds. If called multiple times within the window, only the last call
 * fires (trailing edge).
 *
 * @example
 * const throttledScroll = throttle(onScroll, 100);
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): T & { cancel: () => void } {
  let lastTime: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const throttled = function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = ms - (now - (lastTime ?? 0));

    if (remaining <= 0) {
      // Enough time has passed — fire immediately
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      lastTime = now;
      fn.apply(this, args);
    } else if (timer === undefined) {
      // Schedule a trailing call
      timer = setTimeout(() => {
        lastTime = Date.now();
        timer = undefined;
        fn.apply(this, args);
      }, remaining);
    }
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    lastTime = undefined;
  };

  return throttled;
}

/**
 * Immediately invokes `fn` once, then ignores subsequent calls for `ms` ms.
 * Useful for "immediate first call then cooldown" patterns.
 */
export function onceEvery<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): T & { cancel: () => void } {
  let lastTime = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const throttled = function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastTime >= ms) {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      lastTime = now;
      fn.apply(this, args);
    }
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    lastTime = 0;
  };

  return throttled;
}
