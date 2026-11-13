import { useEffect, useState } from "react";
import {
  AudioLines,
  History,
  Mic2,
  Users,
} from "lucide-react";
import {
  CustomVoicePersona,
  DialogueLine,
  DialogueSpeaker,
  GeneratedClip,
  VoiceId,
  WorkspaceTab,
} from "./types/tts";
import { DIALOGUE_SAMPLES, SAMPLE_SCRIPTS } from "./data/voices";
import {
  deleteClipById,
  loadCustomPersonas,
  loadSavedClips,
  saveClip,
  saveCustomPersonas,
} from "./utils/storage";
import { SpeechSynthesisView } from "./components/SpeechSynthesisView";
import { DialogueStudioView } from "./components/DialogueStudioView";
import { VoiceLibraryView } from "./components/VoiceLibraryView";
import { HistoryView } from "./components/HistoryView";
import { WaveformPlayer } from "./components/WaveformPlayer";

const NAV_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: typeof AudioLines;
}> = [
  { id: "speech", label: "Speech Synthesis", icon: AudioLines },
  { id: "dialogue", label: "Dialogue Studio", icon: Users },
  { id: "voices", label: "Voice Library", icon: Mic2 },
  { id: "history", label: "History", icon: History },
];

const TAB_TITLES: Record<WorkspaceTab, { title: string; subtitle: string }> = {
  speech: {
    title: "Speech Synthesis",
    subtitle: "Convert scripts into expressive studio speech with custom vocal direction",
  },
  dialogue: {
    title: "Dialogue Studio",
    subtitle: "Direct dual-speaker podcasts and screenplays with natural backchanneling",
  },
  voices: {
    title: "Voice Library",
    subtitle: "Audition studio voices and craft custom voice personas",
  },
  history: {
    title: "Audio History",
    subtitle: "Replay, reload, and export your synthesized WAV recordings",
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("speech");

  // Single-speaker studio state
  const [scriptText, setScriptText] = useState(SAMPLE_SCRIPTS[0].text);
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>(
    SAMPLE_SCRIPTS[0].voiceName
  );
  const [stylePrompt, setStylePrompt] = useState(SAMPLE_SCRIPTS[0].style);

  // Dual-speaker studio state
  const [dialogueSpeakers, setDialogueSpeakers] = useState<DialogueSpeaker[]>(
    DIALOGUE_SAMPLES[0].speakers.map((s) => ({ ...s }))
  );
  const [dialogueLines, setDialogueLines] = useState<DialogueLine[]>(
    DIALOGUE_SAMPLES[0].lines.map((l) => ({ ...l }))
  );

  // Saved library state
  const [clips, setClips] = useState<GeneratedClip[]>([]);
  const [customPersonas, setCustomPersonas] = useState<CustomVoicePersona[]>(
    () => loadCustomPersonas()
  );

  // Global docked audio player state
  const [activeClip, setActiveClip] = useState<GeneratedClip | null>(null);
  const [autoPlaySignal, setAutoPlaySignal] = useState(0);

  useEffect(() => {
    loadSavedClips().then((saved) => {
      setClips(saved);
      if (saved.length > 0) {
        setActiveClip(saved[0]);
      }
    });
  }, []);

  const handleClipGenerated = async (clip: GeneratedClip) => {
    setClips((prev) => [clip, ...prev]);
    setActiveClip(clip);
    setAutoPlaySignal((n) => n + 1);
    await saveClip(clip);
  };

  const handleDeleteClip = async (id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    if (activeClip?.id === id) {
      setActiveClip(null);
    }
    await deleteClipById(id);
  };

  const handleSavePersona = (persona: CustomVoicePersona) => {
    setCustomPersonas((prev) => {
      const next = [persona, ...prev];
      saveCustomPersonas(next);
      return next;
    });
  };

  const handleDeletePersona = (id: string) => {
    setCustomPersonas((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveCustomPersonas(next);
      return next;
    });
  };

  const handleLoadClipIntoEditor = (clip: GeneratedClip) => {
    if (clip.mode === "dialogue" && clip.dialogueSpeakers && clip.dialogueLines) {
      setDialogueSpeakers(clip.dialogueSpeakers.map((s) => ({ ...s })));
      setDialogueLines(clip.dialogueLines.map((l) => ({ ...l })));
      setActiveTab("dialogue");
    } else {
      setScriptText(clip.fullText);
      setSelectedVoice(clip.voiceName);
      setStylePrompt(clip.style ?? "");
      setActiveTab("speech");
    }
  };

  const totalCharactersSynthesized = clips.reduce(
    (sum, c) => sum + c.characterCount,
    0
  );

  const headerInfo = TAB_TITLES[activeTab];

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-white text-zinc-900 overflow-hidden">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex md:w-[248px] border-r border-zinc-200 bg-zinc-50/70 flex-col justify-between shrink-0">
        <div>
          <div className="h-16 px-5 border-b border-zinc-200 flex items-center">
            <span className="font-display text-lg font-bold tracking-tight text-zinc-900 whitespace-nowrap">
              Cadence
            </span>
          </div>

          <nav aria-label="Workspace" className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full h-10 px-3 rounded-lg text-sm font-medium flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-white text-zinc-900 border border-zinc-200 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/80 border border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {item.id === "history" && clips.length > 0 && (
                    <span className="font-mono text-xs text-zinc-400 tabular-nums">
                      {clips.length}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Clean Session Usage Summary */}
        <div className="p-4 border-t border-zinc-200">
          <div className="text-xs font-medium text-zinc-900">
            Studio Archive
          </div>
          <div className="mt-1 text-xs text-zinc-500 font-mono tabular-nums">
            {clips.length} {clips.length === 1 ? "clip" : "clips"} ·{" "}
            {totalCharactersSynthesized.toLocaleString()} chars
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Mobile Header & Navigation */}
        <div className="md:hidden border-b border-zinc-200 bg-white px-4 py-2.5 flex items-center justify-between gap-4 shrink-0">
          <span className="font-display text-base font-bold tracking-tight text-zinc-900 whitespace-nowrap">
            Cadence
          </span>
          <div className="flex items-center gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {item.label.split(" ")[0]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop Contextual Top Header */}
        <header className="hidden md:flex h-16 px-6 border-b border-zinc-200 bg-white items-center justify-between gap-8 shrink-0">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-zinc-900 truncate">
              {headerInfo.title}
            </h1>
            <p className="text-xs text-zinc-500 truncate">
              {headerInfo.subtitle}
            </p>
          </div>

          <div className="shrink-0">
            {activeTab !== "speech" && (
              <button
                type="button"
                onClick={() => setActiveTab("speech")}
                className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                New Speech Clip
              </button>
            )}
            {activeTab === "speech" && (
              <button
                type="button"
                onClick={() => setActiveTab("dialogue")}
                className="h-9 px-4 rounded-lg border border-zinc-200 bg-white text-zinc-800 text-xs font-medium hover:bg-zinc-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Switch to Dialogue
              </button>
            )}
          </div>
        </header>

        {/* Active Workspace Viewport */}
        <main className="flex-1 min-h-0 flex flex-col">
          {activeTab === "speech" && (
            <SpeechSynthesisView
              text={scriptText}
              setText={setScriptText}
              selectedVoice={selectedVoice}
              setSelectedVoice={setSelectedVoice}
              stylePrompt={stylePrompt}
              setStylePrompt={setStylePrompt}
              customPersonas={customPersonas}
              onSavePersona={handleSavePersona}
              onClipGenerated={handleClipGenerated}
            />
          )}

          {activeTab === "dialogue" && (
            <DialogueStudioView
              speakers={dialogueSpeakers}
              setSpeakers={setDialogueSpeakers}
              lines={dialogueLines}
              setLines={setDialogueLines}
              onClipGenerated={handleClipGenerated}
            />
          )}

          {activeTab === "voices" && (
            <VoiceLibraryView
              customPersonas={customPersonas}
              onSavePersona={handleSavePersona}
              onDeletePersona={handleDeletePersona}
              onSelectForStudio={(voiceId, style) => {
                setSelectedVoice(voiceId);
                setStylePrompt(style);
                setActiveTab("speech");
              }}
            />
          )}

          {activeTab === "history" && (
            <HistoryView
              clips={clips}
              activeClipId={activeClip?.id ?? null}
              onPlayClip={(clip) => {
                setActiveClip(clip);
                setAutoPlaySignal((n) => n + 1);
              }}
              onLoadIntoEditor={handleLoadClipIntoEditor}
              onDeleteClip={handleDeleteClip}
              onGoToStudio={() => setActiveTab("speech")}
            />
          )}
        </main>

        {/* Global Docked Audio Waveform Player */}
        <WaveformPlayer clip={activeClip} autoPlaySignal={autoPlaySignal} />
      </div>
    </div>
  );
}
