let lockCount = 0;
let scrollPosition = 0;

const isBrowser = () =>
  typeof window !== "undefined" && typeof document !== "undefined";

/**
 * Acquire a global scroll lock. Returns a release function that must be called
 * to restore the previous scroll position and remove locking classes.
 */
export function lockScroll() {
  if (!isBrowser()) {
    return () => {};
  }

  lockCount += 1;

  if (lockCount === 1) {
    scrollPosition =
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    document.documentElement.classList.add("overlay-scroll-locked");
    document.body.classList.add("overlay-scroll-locked");
    document.body.style.top = `-${scrollPosition}px`;
  }

  let released = false;
  return () => {
    if (!isBrowser() || released || lockCount === 0) return;

    released = true;
    lockCount -= 1;

    if (lockCount === 0) {
      document.documentElement.classList.remove("overlay-scroll-locked");
      document.body.classList.remove("overlay-scroll-locked");
      document.body.style.top = "";
      window.scrollTo(0, scrollPosition);
    }
  };
}



