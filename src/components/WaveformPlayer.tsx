import React, { useEffect, useRef, useState } from "react";
import {
  Download,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { GeneratedClip } from "../types/tts";
import {
  base64ToBlobUrl,
  downloadBase64Wav,
  formatDuration,
} from "../utils/audio";

interface WaveformPlayerProps {
  clip: GeneratedClip | null;
  autoPlaySignal: number;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  clip,
  autoPlaySignal,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!clip) {
      setBlobUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const url = base64ToBlobUrl(clip.audioBase64, clip.mimeType);
    setBlobUrl(url);
    setCurrentTime(0);
    setDuration(clip.durationSec || 0);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [clip]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !blobUrl) return;
    audio.playbackRate = playbackRate;
    audio.muted = isMuted;

    if (autoPlaySignal > 0) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [blobUrl, autoPlaySignal]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  if (!clip) {
    return null;
  }

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const nextTime = ratio * duration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const cycleSpeed = () => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(next);
  };

  const effectiveDuration = duration || clip.durationSec || 0;
  const progress =
    effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;

  return (
    <div className="border-t border-zinc-200 bg-white px-6 py-3.5 shrink-0">
      <audio
        ref={audioRef}
        src={blobUrl ?? undefined}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && Number.isFinite(audioRef.current.duration)) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      <div className="max-w-[1360px] mx-auto flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-6">
        {/* Left: Track info & primary controls */}
        <div className="flex items-center gap-3 min-w-0 md:w-[270px] shrink-0">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause audio" : "Play audio"}
            className="w-10 h-10 rounded-full bg-zinc-900 text-white hover:bg-zinc-800 flex items-center justify-center shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleRestart}
            aria-label="Restart clip"
            title="Restart from beginning"
            className="w-8 h-8 rounded-lg border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-zinc-900 truncate">
              {clip.title}
            </div>
            <div className="text-xs text-zinc-500 truncate">
              {clip.voiceSummary}
            </div>
          </div>
        </div>

        {/* Center: Interactive waveform scrubber */}
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="font-mono text-xs text-zinc-500 tabular-nums w-10 text-right shrink-0">
            {formatDuration(currentTime)}
          </span>

          <div
            role="slider"
            tabIndex={0}
            aria-label="Audio playback progress"
            aria-valuemin={0}
            aria-valuemax={Math.round(effectiveDuration)}
            aria-valuenow={Math.round(currentTime)}
            onClick={handleSeek}
            onKeyDown={(e) => {
              if (!audioRef.current || !effectiveDuration) return;
              if (e.key === "ArrowRight") {
                audioRef.current.currentTime = Math.min(
                  effectiveDuration,
                  audioRef.current.currentTime + 2
                );
              } else if (e.key === "ArrowLeft") {
                audioRef.current.currentTime = Math.max(
                  0,
                  audioRef.current.currentTime - 2
                );
              }
            }}
            className="flex-1 h-10 flex items-center gap-[2px] cursor-pointer group select-none"
          >
            {clip.peaks.map((peak, index) => {
              const barRatio = index / clip.peaks.length;
              const isPlayed = barRatio <= progress;
              const heightPct = Math.max(14, Math.round(peak * 100));
              return (
                <div
                  key={index}
                  className={`flex-1 rounded-full transition-colors duration-75 ${
                    isPlayed
                      ? "bg-zinc-900"
                      : "bg-zinc-200 group-hover:bg-zinc-300"
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              );
            })}
          </div>

          <span className="font-mono text-xs text-zinc-500 tabular-nums w-10 shrink-0">
            {formatDuration(effectiveDuration)}
          </span>
        </div>

        {/* Right: Speed, mute & download */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={cycleSpeed}
            title="Cycle playback speed"
            className="h-9 px-2.5 rounded-lg border border-zinc-200 text-xs font-mono font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 tabular-nums transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {playbackRate}x
          </button>

          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            aria-label={isMuted ? "Unmute audio" : "Mute audio"}
            className="w-9 h-9 rounded-lg border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              downloadBase64Wav(
                clip.audioBase64,
                `cadence-${clip.voiceName.toLowerCase()}-${clip.id.slice(0, 6)}.wav`
              )
            }
            className="h-9 px-3.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-900 hover:bg-zinc-50 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download WAV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
