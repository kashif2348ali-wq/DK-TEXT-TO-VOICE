import React, { useRef, useState } from "react";
import {
  ArrowRight,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  CustomVoicePersona,
  StudioVoice,
  VoiceId,
} from "../types/tts";
import { STUDIO_VOICES } from "../data/voices";
import { base64ToBlobUrl } from "../utils/audio";

interface VoiceLibraryViewProps {
  customPersonas: CustomVoicePersona[];
  onSavePersona: (persona: CustomVoicePersona) => void;
  onDeletePersona: (id: string) => void;
  onSelectForStudio: (voiceId: VoiceId, stylePrompt: string) => void;
}

type VoiceFilter = "all" | "feminine" | "masculine" | "custom";

export const VoiceLibraryView: React.FC<VoiceLibraryViewProps> = ({
  customPersonas,
  onSavePersona,
  onDeletePersona,
  onSelectForStudio,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());

  const [filter, setFilter] = useState<VoiceFilter>("all");
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showCreator, setShowCreator] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBaseVoice, setNewBaseVoice] = useState<VoiceId>("Kore");
  const [newStyle, setNewStyle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const playAudition = async (
    id: string,
    voiceName: VoiceId,
    style: string,
    sampleLine: string
  ) => {
    if (playingId === id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);

    const cacheKey = `${voiceName}::${style}::${sampleLine}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      startAudio(id, cached);
      return;
    }

    setLoadingId(id);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sampleLine,
          voiceName,
          style,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to audition voice.");
      }
      cacheRef.current.set(cacheKey, data.audioBase64);
      startAudio(id, data.audioBase64);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Voice audition failed."
      );
    } finally {
      setLoadingId(null);
    }
  };

  const startAudio = (id: string, base64: string) => {
    const url = base64ToBlobUrl(base64, "audio/wav");
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingId(id);
    audio.onended = () => {
      setPlayingId(null);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      setPlayingId(null);
      URL.revokeObjectURL(url);
    };
    audio.play().catch(() => setPlayingId(null));
  };

  const handleCreatePersona = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newStyle.trim()) return;
    onSavePersona({
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      name: newName.trim(),
      baseVoice: newBaseVoice,
      stylePrompt: newStyle.trim(),
      description:
        newDesc.trim() || `Designed on ${newBaseVoice} studio timbre`,
      createdAt: Date.now(),
    });
    setNewName("");
    setNewStyle("");
    setNewDesc("");
    setShowCreator(false);
    setFilter("custom");
  };

  const query = search.trim().toLowerCase();

  const filteredStudioVoices: StudioVoice[] =
    filter === "custom"
      ? []
      : STUDIO_VOICES.filter((v) => {
          if (filter === "feminine" && v.gender !== "Feminine") return false;
          if (filter === "masculine" && v.gender !== "Masculine") return false;
          if (!query) return true;
          return (
            v.name.toLowerCase().includes(query) ||
            v.timbre.toLowerCase().includes(query) ||
            v.description.toLowerCase().includes(query) ||
            v.bestFor.toLowerCase().includes(query)
          );
        });

  const filteredCustomPersonas: CustomVoicePersona[] =
    filter === "feminine" || filter === "masculine"
      ? []
      : customPersonas.filter((p) => {
          if (!query) return true;
          return (
            p.name.toLowerCase().includes(query) ||
            p.baseVoice.toLowerCase().includes(query) ||
            p.stylePrompt.toLowerCase().includes(query)
          );
        });

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white overflow-y-auto">
      {/* Filter & Search Bar */}
      <div className="px-6 py-3.5 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
          {(
            [
              { id: "all", label: "All Voices" },
              { id: "feminine", label: "Feminine" },
              { id: "masculine", label: "Masculine" },
              {
                id: "custom",
                label: `Custom (${customPersonas.length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                filter === tab.id
                  ? "bg-white text-zinc-900 shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-1 sm:flex-initial justify-end">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search voices or timbres..."
              className="w-full h-9 pl-8 pr-3 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowCreator((s) => !s)}
            className="h-9 px-3.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Design Voice</span>
          </button>
        </div>
      </div>

      <div className="max-w-[1280px] w-full mx-auto p-6 space-y-6">
        {errorMsg && (
          <div
            role="alert"
            className="px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 flex items-center justify-between gap-4"
          >
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="font-medium underline cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Inline Voice Design Creator */}
        {showCreator && (
          <form
            onSubmit={handleCreatePersona}
            className="p-5 rounded-xl border border-zinc-300 bg-zinc-50/70 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">
                  Design Custom Voice Persona
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Pair any studio voice with bespoke pacing, accent, and mood direction.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreator(false)}
                aria-label="Close voice designer"
                className="w-8 h-8 rounded-lg hover:bg-zinc-200/70 flex items-center justify-center text-zinc-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Persona Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Midnight Radio Host"
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Base Voice Timbre
                </label>
                <select
                  value={newBaseVoice}
                  onChange={(e) => setNewBaseVoice(e.target.value as VoiceId)}
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
                >
                  {STUDIO_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} — {v.register} ({v.timbre})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Short Description (optional)
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="e.g. Late-night jazz FM announcer"
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Voice Direction Prompt
              </label>
              <textarea
                rows={2}
                required
                value={newStyle}
                onChange={(e) => setNewStyle(e.target.value)}
                placeholder="Describe vocal texture, pacing, warmth, and delivery (e.g. Unhurried, velvety close-mic voice with gentle warmth and subtle pauses)"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={!newStyle.trim()}
                onClick={() =>
                  playAudition(
                    "creator-preview",
                    newBaseVoice,
                    newStyle.trim(),
                    "Here is a live audition of your custom designed voice persona inside Cadence Studio."
                  )
                }
                className="h-9 px-3.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800 disabled:opacity-45 flex items-center gap-1.5 cursor-pointer"
              >
                {loadingId === "creator-preview" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : playingId === "creator-preview" ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Audition Design</span>
              </button>
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 cursor-pointer"
              >
                Save Persona
              </button>
            </div>
          </form>
        )}

        {/* Custom Personas Section */}
        {filteredCustomPersonas.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Your Custom Voice Personas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCustomPersonas.map((persona) => {
                const base =
                  STUDIO_VOICES.find((v) => v.id === persona.baseVoice) ??
                  STUDIO_VOICES[0];
                const isAuditioning = playingId === persona.id;
                const isLoading = loadingId === persona.id;

                return (
                  <article
                    key={persona.id}
                    className="p-5 rounded-xl border border-zinc-200 bg-white flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-lg overflow-hidden bg-zinc-200 shrink-0">
                            <img
                              src={base.avatarUrl}
                              alt={persona.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-zinc-900 truncate">
                              {persona.name}
                            </h3>
                            <p className="text-xs text-zinc-500 truncate">
                              Base: {persona.baseVoice} · Custom Design
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onDeletePersona(persona.id)}
                          aria-label={`Delete ${persona.name}`}
                          className="w-7 h-7 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {persona.stylePrompt}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          playAudition(
                            persona.id,
                            persona.baseVoice,
                            persona.stylePrompt,
                            base.sampleLine
                          )
                        }
                        className="h-8 px-3 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isAuditioning ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>{isAuditioning ? "Stop" : "Audition"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onSelectForStudio(
                            persona.baseVoice,
                            persona.stylePrompt
                          )
                        }
                        className="h-8 px-3 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <span>Use in Studio</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Core Studio Voices Grid */}
        {filteredStudioVoices.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Studio Voices
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredStudioVoices.map((voice) => {
                const isAuditioning = playingId === voice.id;
                const isLoading = loadingId === voice.id;

                return (
                  <article
                    key={voice.id}
                    className="p-5 rounded-xl border border-zinc-200 bg-white flex flex-col justify-between gap-4 hover:border-zinc-300 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center gap-3.5">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0">
                          <img
                            src={voice.avatarUrl}
                            alt={`${voice.name} portrait`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-semibold text-zinc-900 truncate">
                            {voice.name}
                          </h3>
                          <p className="text-xs text-zinc-500 truncate">
                            {voice.register} · {voice.timbre}
                          </p>
                          <p className="text-xs text-zinc-400 truncate mt-0.5">
                            {voice.bestFor}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {voice.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          playAudition(
                            voice.id,
                            voice.id,
                            voice.defaultStyle,
                            voice.sampleLine
                          )
                        }
                        className="h-9 px-3.5 rounded-lg border border-zinc-200 text-xs font-medium text-zinc-800 hover:bg-zinc-50 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isAuditioning ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                        <span>{isAuditioning ? "Stop" : "Audition"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onSelectForStudio(voice.id, voice.defaultStyle)
                        }
                        className="h-9 px-3.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>Use in Studio</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {filteredStudioVoices.length === 0 &&
          filteredCustomPersonas.length === 0 && (
            <div className="py-16 text-center border border-dashed border-zinc-200 rounded-xl">
              <p className="text-sm font-medium text-zinc-900">
                {filter === "custom" && customPersonas.length === 0
                  ? "No custom voice personas yet"
                  : "No matching voices found"}
              </p>
              <p className="text-xs text-zinc-500 mt-1 mb-4">
                {filter === "custom" && customPersonas.length === 0
                  ? "Design your own vocal persona with custom pacing, warmth, and character."
                  : "Try clearing your search query or switching category filters."}
              </p>
              {filter === "custom" && customPersonas.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreator(true)}
                  className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 cursor-pointer"
                >
                  Design First Persona
                </button>
              )}
            </div>
          )}
      </div>
    </div>
  );
};
