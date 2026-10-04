export type Token = {
  id: number;
  start: number;
  end: number;
  normalized: string;
  folded: string;
};
export type Preset = {
  id: string;
  name: string;
  width: number;
  height: number;
  fontSize: number;
  lineSpacing: number;
  speed: number;
};
export type ViewportSnapshot = {
  generation: number;
  revision: number;
  visibleIds: number[];
  anchorId: number | null;
};
export type TranscriptUpdate = {
  generation: number;
  sequence: number;
  viewport: ViewportSnapshot;
  text: string;
  audioEndMs: number;
  speechEndMs: number;
  inferenceMs: number;
};
export type MatchDecision =
  { kind: "hold" } | { kind: "move"; tokenId: number; score: number };
export type State = {
  script: string;
  preset: Preset;
  hasPreferences: boolean;
  mode: "voice" | "fixed";
  status: string;
  generation: number;
  owner: string | null;
  prompter: string | null;
  model: string;
  detail: string;
};
