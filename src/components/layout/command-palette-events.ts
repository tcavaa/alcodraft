/** Lets any button open the ⌘K palette without sharing React state. */
export const COMMAND_PALETTE_EVENT = "alcodraft:command-palette";

export function openCommandPalette() {
  window.dispatchEvent(new Event(COMMAND_PALETTE_EVENT));
}
