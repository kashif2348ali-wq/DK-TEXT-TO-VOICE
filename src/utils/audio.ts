export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function base64ToBlobUrl(base64: string, mimeType = "audio/wav"): string {
  const bytes = base64ToUint8Array(base64);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

export function downloadBase64Wav(base64: string, filename: string): void {
  const url = base64ToBlobUrl(base64, "audio/wav");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".wav") ? filename : `${filename}.wav`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function analyzeAudioBase64(
  base64: string,
  barCount = 88
): Promise<{ durationSec: number; peaks: number[] }> {
  const fallbackPeaks = Array.from({ length: barCount }, (_, i) => {
    const wave = Math.sin(i * 0.35) * 0.25 + Math.cos(i * 0.17) * 0.2 + 0.45;
    return Math.max(0.12, Math.min(0.95, wave));
  });

  try {
    const bytes = base64ToUint8Array(base64);
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) {
      return { durationSec: 0, peaks: fallbackPeaks };
    }

    const ctx = new AudioCtx();
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    );
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer as ArrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(channelData.length / barCount));
    const peaks: number[] = [];
    let maxPeak = 0.001;

    for (let i = 0; i < barCount; i++) {
      const start = i * step;
      const end = Math.min(channelData.length, start + step);
      let peak = 0;
      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > peak) peak = val;
      }
      if (peak > maxPeak) maxPeak = peak;
      peaks.push(peak);
    }

    const normalized = peaks.map((p) =>
      Math.max(0.08, Math.min(1, p / maxPeak))
    );
    const durationSec = audioBuffer.duration;
    await ctx.close();
    return { durationSec, peaks: normalized };
  } catch {
    return { durationSec: 0, peaks: fallbackPeaks };
  }
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function estimateReadingSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round((words / 150) * 60));
}
