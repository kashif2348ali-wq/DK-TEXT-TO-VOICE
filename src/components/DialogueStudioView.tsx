import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import {
  DialogueLine,
  DialogueSpeaker,
  GeneratedClip,
  VoiceId,
} from "../types/tts";
import { DIALOGUE_SAMPLES, STUDIO_VOICES, VOCAL_CUES } from "../data/voices";
import { analyzeAudioBase64 } from "../utils/audio";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface DialogueStudioViewProps {
  speakers: DialogueSpeaker[];
  setSpeakers: React.Dispatch<React.SetStateAction<DialogueSpeaker[]>>;
  lines: DialogueLine[];
  setLines: React.Dispatch<React.SetStateAction<DialogueLine[]>>;
  onClipGenerated: (clip: GeneratedClip) => void;
}

export const DialogueStudioView: React.FC<DialogueStudioViewProps> = ({
  speakers,
  setSpeakers,
  lines,
  setLines,
  onClipGenerated,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [focusedLineId, setFocusedLineId] = useState<string | null>(
    lines[0]?.id ?? null
  );

  const updateSpeaker = (
    index: number,
    patch: Partial<DialogueSpeaker>
  ) => {
    setSpeakers((prev) => {
      const oldName = prev[index].speaker;
      const next = prev.map((sp, i) => (i === index ? { ...sp, ...patch } : sp));
      if (patch.speaker !== undefined && patch.speaker !== oldName) {
        setLines((prevLines) =>
          prevLines.map((l) =>
            l.speaker === oldName ? { ...l, speaker: patch.speaker! } : l
          )
        );
      }
      return next;
    });
  };

  const addLine = () => {
    const lastSpeaker = lines[lines.length - 1]?.speaker;
    const nextSpeaker =
      lastSpeaker === speakers[0].speaker
        ? speakers[1].speaker
        : speakers[0].speaker;
    const newId = createId();
    setLines((prev) => [
      ...prev,
      { id: newId, speaker: nextSpeaker, text: "" },
    ]);
    setFocusedLineId(newId);
  };

  const updateLine = (id: string, patch: Partial<DialogueLine>) => {
    setLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  };

  const removeLine = (id: string) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const moveLine = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= lines.length) return;
    setLines((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const insertCueIntoFocusedLine = (token: string) => {
    const targetId = focusedLineId ?? lines[lines.length - 1]?.id;
    if (!targetId) return;
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== targetId) return line;
        const spacer =
          line.text && !line.text.endsWith(" ") ? " " : "";
        return { ...line, text: `${line.text}${spacer}${token}` };
      })
    );
  };

  const handleGenerateDialogue = async () => {
    const validLines = lines.filter((l) => l.text.trim().length > 0);
    if (validLines.length === 0) {
      setErrorMsg("Please enter at least one spoken line in the script.");
      return;
    }

    if (
      !speakers[0].speaker.trim() ||
      !speakers[1].speaker.trim() ||
      speakers[0].speaker.trim() === speakers[1].speaker.trim()
    ) {
      setErrorMsg("Speaker 1 and Speaker 2 must have unique non-empty names.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/tts/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speakers: speakers.map((s) => ({
            speaker: s.speaker.trim(),
            voiceName: s.voiceName,
            style: s.style.trim(),
          })),
          lines: validLines.map((l) => ({
            speaker: l.speaker.trim(),
            text: l.text.trim(),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Dialogue synthesis failed.");
      }

      const { durationSec, peaks } = await analyzeAudioBase64(
        data.audioBase64
      );

      const fullScript = validLines
        .map((l) => `${l.speaker}: ${l.text.trim()}`)
        .join("\n");
      const totalChars = validLines.reduce((sum, l) => sum + l.text.length, 0);

      const clip: GeneratedClip = {
        id: createId(),
        mode: "dialogue",
        title: `${speakers[0].speaker} & ${speakers[1].speaker} Dialogue`,
        textPreview: validLines[0].text.trim(),
        fullText: fullScript,
        voiceSummary: `${speakers[0].speaker} (${speakers[0].voiceName}) & ${speakers[1].speaker} (${speakers[1].voiceName})`,
        voiceName: speakers[0].voiceName,
        dialogueSpeakers: speakers,
        dialogueLines: validLines,
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || "audio/wav",
        durationSec,
        peaks,
        characterCount: totalChars,
        createdAt: Date.now(),
      };

      onClipGenerated(clip);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Dialogue generation failed."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const totalChars = lines.reduce((sum, l) => sum + l.text.length, 0);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white overflow-y-auto">
      {/* Sample Screenplays Bar */}
      <div className="px-6 py-3 border-b border-zinc-200 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-medium text-zinc-500 whitespace-nowrap">
            Load screenplay:
          </span>
          {DIALOGUE_SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => {
                setSpeakers(sample.speakers.map((s) => ({ ...s })));
                setLines(sample.lines.map((l) => ({ ...l })));
                setFocusedLineId(sample.lines[0]?.id ?? null);
                setErrorMsg(null);
              }}
              className="px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {sample.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-zinc-500 font-mono tabular-nums shrink-0">
          {lines.length} turns · {totalChars.toLocaleString()} chars
        </span>
      </div>

      <div className="max-w-[1160px] w-full mx-auto p-6 space-y-6 flex-1">
        {/* Dual Speaker Cast Configuration */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Speaker Cast
            </h2>
            <span className="text-xs text-zinc-500">
              Dual-speaker synthesis with distinct voice personas
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {speakers.map((sp, index) => {
              const voiceInfo =
                STUDIO_VOICES.find((v) => v.id === sp.voiceName) ??
                STUDIO_VOICES[0];
              return (
                <div
                  key={sp.id}
                  className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-200 shrink-0">
                      <img
                        src={voiceInfo.avatarUrl}
                        alt={voiceInfo.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                          Speaker {index + 1} Name
                        </label>
                        <input
                          type="text"
                          value={sp.speaker}
                          onChange={(e) =>
                            updateSpeaker(index, { speaker: e.target.value })
                          }
                          className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                          Studio Voice
                        </label>
                        <select
                          value={sp.voiceName}
                          onChange={(e) =>
                            updateSpeaker(index, {
                              voiceName: e.target.value as VoiceId,
                            })
                          }
                          className="w-full h-9 px-2.5 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
                        >
                          {STUDIO_VOICES.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.register})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                      Voice Direction &amp; Persona
                    </label>
                    <input
                      type="text"
                      value={sp.style}
                      onChange={(e) =>
                        updateSpeaker(index, { style: e.target.value })
                      }
                      placeholder="e.g. Curious, articulate podcast co-host"
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-white text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Screenplay Lines */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-zinc-900">
              Dialogue Script
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-zinc-500 mr-1">
                Insert into active turn:
              </span>
              {VOCAL_CUES.map((cue) => (
                <button
                  key={cue.token}
                  type="button"
                  title={cue.hint}
                  onClick={() => insertCueIntoFocusedLine(cue.token)}
                  className="px-2 py-1 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-mono text-zinc-700 transition-colors cursor-pointer"
                >
                  {cue.token}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-200 bg-white overflow-hidden">
            {lines.map((line, index) => {
              const isFirstSpeaker = line.speaker === speakers[0].speaker;
              return (
                <div
                  key={line.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-start gap-3 hover:bg-zinc-50/50 transition-colors"
                >
                  <div className="flex items-center gap-2 shrink-0 sm:w-[165px]">
                    <span className="font-mono text-xs text-zinc-400 tabular-nums w-5">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        updateLine(line.id, {
                          speaker: isFirstSpeaker
                            ? speakers[1].speaker
                            : speakers[0].speaker,
                        })
                      }
                      title="Click to switch speaker"
                      className={`flex-1 h-8 px-2.5 rounded-lg text-xs font-medium border text-left truncate transition-colors cursor-pointer ${
                        isFirstSpeaker
                          ? "bg-zinc-900 text-white border-zinc-900"
                          : "bg-white text-zinc-900 border-zinc-300 hover:bg-zinc-100"
                      }`}
                    >
                      {line.speaker}
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    value={line.text}
                    onFocus={() => setFocusedLineId(line.id)}
                    onChange={(e) =>
                      updateLine(line.id, { text: e.target.value })
                    }
                    placeholder={`What does ${line.speaker} say?`}
                    className="flex-1 min-w-0 bg-transparent text-sm leading-relaxed text-zinc-900 placeholder:text-zinc-400 focus:outline-none resize-none py-1"
                  />

                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveLine(index, -1)}
                      aria-label="Move turn up"
                      className="w-7 h-7 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === lines.length - 1}
                      onClick={() => moveLine(index, 1)}
                      aria-label="Move turn down"
                      className="w-7 h-7 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={lines.length <= 1}
                      onClick={() => removeLine(line.id)}
                      aria-label="Delete turn"
                      className="w-7 h-7 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="mt-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 flex items-center justify-between gap-4"
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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={addLine}
              className="h-9 px-3.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-xs font-medium text-zinc-800 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Dialogue Turn</span>
            </button>

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerateDialogue}
              className="h-10 px-5 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-45 disabled:cursor-not-allowed flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Dialogue...</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>Generate Dialogue</span>
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
