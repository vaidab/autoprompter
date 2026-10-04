import workletURL from "./audio-worklet.ts?worker&url";
export async function startCapture(
  deviceId: string | undefined,
  onSamples: (samples: Float32Array) => void,
): Promise<{ stop(): void }> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const context = new AudioContext();
  let source: MediaStreamAudioSourceNode | undefined,
    node: AudioWorkletNode | undefined;
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    node?.disconnect();
    source?.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void context.close();
  }
  try {
    await context.audioWorklet.addModule(workletURL);
    await context.resume();
    source = context.createMediaStreamSource(stream);
    node = new AudioWorkletNode(context, "capture");
    node.port.onmessage = (e) => {
      if (!stopped) onSamples(e.data);
    };
    source.connect(node);
    node.connect(context.destination);
    for (const track of stream.getTracks())
      track.onended = () => {
        stop();
        document.dispatchEvent(new CustomEvent("microphone-lost"));
      };
    return { stop };
  } catch (e) {
    stop();
    throw e;
  }
}
