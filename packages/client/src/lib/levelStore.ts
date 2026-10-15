// Tiny external store for the live audio level. The level changes ~12 times a
// second; keeping it out of React state means only the meter bar re-renders,
// not the whole control panel around it (which made the right side flicker).
let current = 0;
const listeners = new Set<() => void>();

export const levelStore = {
  get: () => current,
  set(value: number) {
    const v = Math.round(value * 20) / 20;
    if (v === current) return;
    current = v;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
