import type { TranscriptUpdate, ViewportSnapshot } from "./protocol";
export function acceptUpdate(
  update: TranscriptUpdate,
  current: ViewportSnapshot,
  lastSequence: number,
): boolean {
  return (
    update.generation === current.generation &&
    update.viewport.generation === current.generation &&
    update.sequence > lastSequence
  );
}
