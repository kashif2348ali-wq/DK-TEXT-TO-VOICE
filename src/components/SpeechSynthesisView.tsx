import React, { useRef, useState } from "react";
import {
  BookmarkPlus,
  Check,
  Loader2,
  Pause,
  Play,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";
import {
  CustomVoicePersona,
  GeneratedClip,
  StudioVoice,
  VoiceId,
} from "../types/tts";
import {
  SAMPLE_SCRIPTS,
  STUDIO_VOICES,
  STYLE_PRESETS,
  VOCAL_CUES,
} from "../data/voices";
import {
  analyzeAudioBase64,
  base64ToBlobUrl,
  estimateReadingSeconds,
  formatDuration,
} from "../utils/audio";

interface SpeechSynthesisViewProps {
  text: string;
  setText: (val: string) => void;
  selectedVoice: VoiceId;
  setSelectedVoice: (voice: VoiceId) => void;
  stylePrompt: string;
  setStylePrompt: (style: string) => void;
  customPersonas: CustomVoicePersona[];
  onSavePersona: (persona: CustomVoicePersona) => void;
  onClipGenerated: (clip: GeneratedClip) => void;
}

const MAX_CHARS = 5000;

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const SpeechSynthesisView: React.FC<SpeechSynthesisViewProps> = ({
  text,
  setText,
  selectedVoice,
  setSelectedVoice,
  stylePrompt,
  setStylePrompt,
  customPersonas,
  onSavePersona,
  onClipGenerated,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewCacheRef = useRef<Map<string, string>>(new Map());

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [auditioningVoiceId, setAuditioningVoiceId] = useState<string | null>(
    null
  );
  const [loadingAuditionId, setLoadingAuditionId] = useState<string | null>(
    null
  );

  const [showSaveForm, setShowSaveForm] = useState(false);
  const [personaName, setPersonaName] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);

  const activeVoice: StudioVoice =
    STUDIO_VOICES.find((v) => v.id === selectedVoice) ?? STUDIO_VOICES[0];

  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estSeconds = estimateReadingSeconds(text);

  const insertCueAtCursor = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText(text ? `${text} ${token}` : token);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const before = text.slice(0, start);
    const after = text.slice(end);
    const spacerBefore =
      before.length > 0 && !before.endsWith(" ") && !before.endsWith("\n")
        ? " "
        : "";
    const spacerAfter =
      after.length > 0 && !after.startsWith(" ") && !after.startsWith("\n")
        ? " "
        : "";
    const updated = `${before}${spacerBefore}${token}${spacerAfter}${after}`;
    setText(updated);

    requestAnimationFrame(() => {
      el.focus();
      const nextPos = start + spacerBefore.length + token.length + spacerAfter.length;
      el.setSelectionRange(nextPos, nextPos);
    });
  };

  const handleAuditionVoice = async (
    voice: StudioVoice,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (auditioningVoiceId === voice.id && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      setAuditioningVoiceId(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setAuditioningVoiceId(null);

    const cacheKey = `${voice.id}::${voice.defaultStyle}`;
    const cachedBase64 = previewCacheRef.current.get(cacheKey);

    if (cachedBase64) {
      playPreviewBase64(voice.id, cachedBase64);
      return;
    }

    setLoadingAuditionId(voice.id);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: voice.sampleLine,
          voiceName: voice.id,
          style: voice.defaultStyle,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to preview voice.");
      }
      previewCacheRef.current.set(cacheKey, data.audioBase64);
      playPreviewBase64(voice.id, data.audioBase64);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Voice audition failed."
      );
    } finally {
      setLoadingAuditionId(null);
    }
  };

  const playPreviewBase64 = (voiceId: string, base64: string) => {
    const url = base64ToBlobUrl(base64, "audio/wav");
    const audio = new Audio(url);
    previewAudioRef.current = audio;
    setAuditioningVoiceId(voiceId);
    audio.onended = () => {
      setAuditioningVoiceId(null);
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      setAuditioningVoiceId(null);
      URL.revokeObjectURL(url);
    };
    audio.play().catch(() => {
      setAuditioningVoiceId(null);
    });
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setErrorMsg("Enter text in the editor before generating speech.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          voiceName: selectedVoice,
          style: stylePrompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Speech synthesis failed.");
      }

      const { durationSec, peaks } = await analyzeAudioBase64(
        data.audioBase64
      );
      const cleanPreview = text.trim().replace(/\s+/g, " ");
      const title =
        cleanPreview.length > 48
          ? `${cleanPreview.slice(0, 48)}...`
          : cleanPreview;

      const clip: GeneratedClip = {
        id: createId(),
        mode: "speech",
        title,
        textPreview: cleanPreview,
        fullText: text.trim(),
        voiceSummary: stylePrompt.trim()
          ? `${activeVoice.name} · ${stylePrompt.trim().slice(0, 36)}${
              stylePrompt.trim().length > 36 ? "..." : ""
            }`
          : `${activeVoice.name} · ${activeVoice.timbre}`,
        voiceName: selectedVoice,
        style: stylePrompt.trim() || undefined,
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || "audio/wav",
        durationSec,
        peaks,
        characterCount: text.trim().length,
        createdAt: Date.now(),
      };

      onClipGenerated(clip);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Unable to synthesize speech."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSavePersona = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaName.trim()) return;
    onSavePersona({
      id: createId(),
      name: personaName.trim(),
      baseVoice: selectedVoice,
      stylePrompt: stylePrompt.trim() || activeVoice.defaultStyle,
      description: `Custom ${activeVoice.name} persona`,
      createdAt: Date.now(),
    });
    setPersonaName("");
    setShowSaveForm(false);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      {/* Main Script Editor Column */}
      <div className="flex-1 flex flex-col min-w-0 lg:min-h-0 bg-white">
        {/* Sample Script Strip */}
        <div className="px-6 py-3 border-b border-zinc-200 flex items-center justify-between gap-4 overflow-x-auto shrink-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-zinc-500 whitespace-nowrap">
              Load sample:
            </span>
            {SAMPLE_SCRIPTS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => {
                  setText(sample.text);
                  setSelectedVoice(sample.voiceName);
                  setStylePrompt(sample.style);
                  setErrorMsg(null);
                }}
                className="px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {sample.label}
              </button>
            ))}
          </div>

          {text.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setText("");
                requestAnimationFrame(() => textareaRef.current?.focus());
              }}
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear text</span>
            </button>
          )}
        </div>

        {/* Textarea Canvas */}
        <div className="flex-1 flex flex-col p-6 min-h-[260px] lg:min-h-0">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="tts-script-input"
              className="text-xs font-medium text-zinc-600"
            >
              Script Text
            </label>
            <span className="text-xs text-zinc-400">
              Type or paste text to convert to speech
            </span>
          </div>

          <div
            onClick={() => textareaRef.current?.focus()}
            className="flex-1 min-h-[180px] rounded-xl border border-zinc-200 focus-within:border-zinc-900 bg-white p-4 flex flex-col transition-colors cursor-text"
          >
            <textarea
              id="tts-script-input"
              ref={textareaRef}
              value={text}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length > MAX_CHARS) {
                  setText(val.slice(0, MAX_CHARS));
                  setErrorMsg(
                    `Script trimmed to the ${MAX_CHARS.toLocaleString()} character limit.`
                  );
                } else {
                  setText(val);
                  if (errorMsg?.startsWith("Script trimmed")) {
                    setErrorMsg(null);
                  }
                }
              }}
              placeholder="Type or paste the text you want to convert to speech. Use cues like <breath> or <laugh> for natural studio expression..."
              className="flex-1 w-full h-full min-h-[140px] resize-none bg-transparent text-[16px] leading-[1.7] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
          </div>

          {/* Error Feedback Banner */}
          {errorMsg && (
            <div
              role="alert"
              className="mt-3 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 flex items-center justify-between gap-4"
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

          {/* Vocal Expression Cue Bar */}
          <div className="mt-4 pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-zinc-500 mr-1 whitespace-nowrap">
                Insert cue:
              </span>
              {VOCAL_CUES.map((cue) => (
                <button
                  key={cue.token}
                  type="button"
                  title={cue.hint}
                  onClick={() => insertCueAtCursor(cue.token)}
                  className="px-2.5 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-mono text-zinc-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {cue.token}
                </button>
              ))}
            </div>

            <div className="text-xs text-zinc-500 font-mono tabular-nums flex items-center gap-2 shrink-0">
              <span>{charCount.toLocaleString()} / 5,000 chars</span>
              <span aria-hidden="true">·</span>
              <span>{wordCount} words</span>
              <span aria-hidden="true">·</span>
              <span>~{formatDuration(estSeconds)}</span>
            </div>
          </div>
        </div>

        {/* Bottom Generation Action Bar */}
        <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/70 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-200 shrink-0 border border-zinc-200">
              <img
                src={activeVoice.avatarUrl}
                alt={`${activeVoice.name} studio portrait`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900 truncate">
                {activeVoice.name}
              </div>
              <div className="text-xs text-zinc-500 truncate max-w-[340px]">
                {stylePrompt.trim() || `${activeVoice.register} · ${activeVoice.timbre}`}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isGenerating || !text.trim()}
            onClick={handleGenerate}
            className="h-10 px-5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" />
                <span>Generate Speech</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Inspector Panel: Voice Selection & Voice Design */}
      <aside className="w-full lg:w-[360px] xl:w-[380px] border-t lg:border-t-0 lg:border-l border-zinc-200 bg-zinc-50/50 flex flex-col lg:overflow-y-auto shrink-0">
        {/* Voice Picker */}
        <div className="p-5 border-b border-zinc-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Studio Voice
            </h2>
            <span className="text-xs text-zinc-500">5 Voices</span>
          </div>

          <div className="space-y-2">
            {STUDIO_VOICES.map((voice) => {
              const isSelected = voice.id === selectedVoice;
              const isAuditioning = auditioningVoiceId === voice.id;
              const isLoading = loadingAuditionId === voice.id;

              return (
                <div
                  key={voice.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedVoice(voice.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedVoice(voice.id);
                    }
                  }}
                  className={`p-2.5 rounded-xl border flex items-center gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-white border-zinc-900 shadow-xs"
                      : "bg-white/70 border-zinc-200 hover:border-zinc-300 hover:bg-white"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-200 shrink-0">
                    <img
                      src={voice.avatarUrl}
                      alt={voice.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900 truncate">
                        {voice.name}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      {voice.register} · {voice.timbre}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleAuditionVoice(voice, e)}
                    aria-label={`Audition ${voice.name}`}
                    title={`Audition ${voice.name}`}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      isAuditioning
                        ? "bg-zinc-900 border-zinc-900 text-white"
                        : "border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                    }`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isAuditioning ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Voice Design & Style Direction */}
        <div className="p-5 border-b border-zinc-200">
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="voice-style-prompt"
              className="text-sm font-semibold text-zinc-900"
            >
              Voice Design &amp; Delivery
            </label>
            {stylePrompt && (
              <button
                type="button"
                onClick={() => setStylePrompt("")}
                className="text-xs text-zinc-500 hover:text-zinc-900 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
            Direct tone, accent, pacing, or emotional texture for your selected voice.
          </p>

          <textarea
            id="voice-style-prompt"
            rows={3}
            value={stylePrompt}
            onChange={(e) => setStylePrompt(e.target.value)}
            placeholder={activeVoice.defaultStyle}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 resize-none"
          />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {STYLE_PRESETS.map((preset) => {
              const active = stylePrompt === preset.stylePrompt;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setStylePrompt(preset.stylePrompt)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-zinc-900 border-zinc-900 text-white"
                      : "bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            {!showSaveForm ? (
              <button
                type="button"
                onClick={() => setShowSaveForm(true)}
                className="w-full h-9 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {savedNotice ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Saved to Voice Library</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>Save as Custom Persona</span>
                  </>
                )}
              </button>
            ) : (
              <form onSubmit={handleSavePersona} className="flex gap-2">
                <input
                  type="text"
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  placeholder="Persona name (e.g. Late Night Host)"
                  autoFocus
                  className="flex-1 h-9 px-3 rounded-lg border border-zinc-300 bg-white text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
                <button
                  type="submit"
                  className="h-9 px-3 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 cursor-pointer shrink-0"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveForm(false)}
                  className="h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-600 hover:text-zinc-900 cursor-pointer shrink-0"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Saved Custom Personas Quick Switcher */}
        {customPersonas.length > 0 && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
                <span>Saved Custom Personas</span>
              </h3>
              <span className="text-xs text-zinc-500 tabular-nums">
                {customPersonas.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {customPersonas.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => {
                    setSelectedVoice(persona.baseVoice);
                    setStylePrompt(persona.stylePrompt);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg border border-zinc-200 bg-white hover:border-zinc-300 transition-colors cursor-pointer"
                >
                  <div className="text-xs font-medium text-zinc-900 truncate">
                    {persona.name}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">
                    {persona.baseVoice} · {persona.stylePrompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
