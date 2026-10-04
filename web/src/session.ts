import type { State } from "./protocol";
export type Message = { type: string; [key: string]: any };
export class SessionClient {
  id = "";
  state: State | null = null;
  private socket: WebSocket | null = null;
  private listeners = new Set<(m: Message) => void>();
  private ended = false;
  constructor(private role: "setup" | "prompter") {
    this.connect();
    window.addEventListener("pagehide", () => this.close());
  }
  private connect() {
    if (this.ended) return;
    this.socket = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
    );
    this.socket.onopen = () => this.send({ role: this.role });
    this.socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "welcome") this.id = msg.id;
      if (msg.type === "state") this.state = msg.state;
      if (msg.type === "stopped") this.ended = true;
      this.emit(msg);
    };
    this.socket.onclose = () => {
      this.state = null;
      this.emit({ type: this.ended ? "stopped" : "disconnected" });
      if (!this.ended) setTimeout(() => this.connect(), 1500);
    };
  }
  private emit(m: Message) {
    for (const fn of this.listeners) fn(m);
  }
  subscribe(fn: (m: Message) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  send(m: Message | Record<string, unknown>) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(m));
  }
  audio(header: Record<string, unknown>, samples: Float32Array) {
    if (
      this.socket?.readyState === WebSocket.OPEN &&
      this.socket.bufferedAmount < 256000
    ) {
      this.socket.send(
        JSON.stringify({ ...header, type: "audio", sampleRate: 16000 }),
      );
      this.socket.send(samples);
    }
  }
  close() {
    this.ended = true;
    this.socket?.close();
  }
}
export function connectSession(role: "setup" | "prompter") {
  return new SessionClient(role);
}
