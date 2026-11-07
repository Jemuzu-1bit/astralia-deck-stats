const INTERFACE_SIZE_KEY = "astralia.gameInterfaceSize.v1";
export const INTERFACE_SIZE_CHANGE_EVENT = "astralia:interface-size-change";

export function savedInterfaceSize(): number {
  try {
    const value = Number(localStorage.getItem(INTERFACE_SIZE_KEY));
    if (Number.isInteger(value) && value >= 75 && value <= 150) return value;
  } catch { /* use the default size */ }
  return 100;
}

export function saveInterfaceSize(value: number): void {
  try { localStorage.setItem(INTERFACE_SIZE_KEY, String(value)); } catch { /* keep this session's preference */ }
  window.dispatchEvent(new CustomEvent<number>(INTERFACE_SIZE_CHANGE_EVENT, { detail: value }));
}
