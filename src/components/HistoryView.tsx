import React, { useState } from "react";
import {
  ArrowUpRight,
  Download,
  Play,
  Search,
  Trash2,
  Volume2,
} from "lucide-react";
import { GeneratedClip } from "../types/tts";
import { downloadBase64Wav, formatDuration } from "../utils/audio";

interface HistoryViewProps {
  clips: GeneratedClip[];
  activeClipId: string | null;
  onPlayClip: (clip: GeneratedClip) => void;
  onLoadIntoEditor: (clip: GeneratedClip) => void;
  onDeleteClip: (id: string) => void;
  onGoToStudio: () => void;
}

type ModeFilter = "all" | "speech" | "dialogue";

export const HistoryView: React.FC<HistoryViewProps> = ({
  clips,
  activeClipId,
  onPlayClip,
  onLoadIntoEditor,
  onDeleteClip,
  onGoToStudio,
}) => {
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");

  const query = search.trim().toLowerCase();
  const filtered = clips.filter((c) => {
    if (modeFilter !== "all" && c.mode !== modeFilter) return false;
    if (!query) return true;
    return (
      c.fullText.toLowerCase().includes(query) ||
      c.voiceSummary.toLowerCase().includes(query) ||
      c.title.toLowerCase().includes(query)
    );
  });

  const formatTimestamp = (ts: number) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white overflow-y-auto">
      {/* Search & Filter Toolbar */}
      <div className="px-6 py-3.5 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
          {(
            [
              { id: "all", label: `All Clips (${clips.length})` },
              { id: "speech", label: "Single Speaker" },
              { id: "dialogue", label: "Dialogue" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setModeFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                modeFilter === tab.id
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search generated scripts or voices..."
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
          />
        </div>
      </div>

      <div className="max-w-[1200px] w-full mx-auto p-6">
        {clips.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-zinc-200 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-700 flex items-center justify-center mx-auto mb-3">
              <Volume2 className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-900">
              No generated audio clips yet
            </h2>
            <p className="text-xs text-zinc-500 mt-1 mb-5 max-w-sm mx-auto leading-relaxed">
              Every single-speaker narration or dual-speaker dialogue you generate is archived here for instant replay and WAV export.
            </p>
            <button
              type="button"
              onClick={onGoToStudio}
              className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Go to Speech Synthesis
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-zinc-200 rounded-xl">
            <p className="text-sm font-medium text-zinc-900">
              No clips match your filter
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Try a different keyword or switch back to All Clips.
            </p>
          </div>
        ) : (
          <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-200 overflow-hidden bg-white">
            {filtered.map((clip) => {
              const isActive = clip.id === activeClipId;
              return (
                <div
                  key={clip.id}
                  className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                    isActive ? "bg-zinc-50" : "hover:bg-zinc-50/60"
                  }`}
                >
                  <div className="flex items-start md:items-center gap-3.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onPlayClip(clip)}
                      aria-label={`Play ${clip.title}`}
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        isActive
                          ? "bg-zinc-900 text-white"
                          : "border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100"
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-zinc-900 truncate">
                        {clip.textPreview}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>
                          {clip.mode === "dialogue"
                            ? "Dialogue"
                            : "Single Speaker"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-[260px]">
                          {clip.voiceSummary}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatDuration(clip.durationSec)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {clip.characterCount.toLocaleString()} chars
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatTimestamp(clip.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => onLoadIntoEditor(clip)}
                      className="h-8 px-3 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span>Open in Studio</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        downloadBase64Wav(
                          clip.audioBase64,
                          `cadence-${clip.voiceName.toLowerCase()}-${clip.id.slice(
                            0,
                            6
                          )}.wav`
                        )
                      }
                      aria-label="Download WAV"
                      title="Download WAV"
                      className="w-8 h-8 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteClip(clip.id)}
                      aria-label="Delete clip"
                      title="Delete clip"
                      className="w-8 h-8 rounded-lg border border-zinc-200 bg-white hover:bg-red-50 text-zinc-400 hover:text-red-600 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
