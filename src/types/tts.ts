export type VoiceId = "Kore" | "Puck" | "Charon" | "Fenrir" | "Zephyr";

export type WorkspaceTab = "speech" | "dialogue" | "voices" | "history";

export interface StudioVoice {
  id: VoiceId;
  name: string;
  gender: "Feminine" | "Masculine";
  register: string;
  timbre: string;
  description: string;
  defaultStyle: string;
  sampleLine: string;
  avatarUrl: string;
  bestFor: string;
}

export interface StylePreset {
  id: string;
  label: string;
  stylePrompt: string;
}

export interface CustomVoicePersona {
  id: string;
  name: string;
  baseVoice: VoiceId;
  stylePrompt: string;
  description: string;
  createdAt: number;
}

export interface DialogueSpeaker {
  id: string;
  speaker: string;
  voiceName: VoiceId;
  style: string;
}

export interface DialogueLine {
  id: string;
  speaker: string;
  text: string;
}

export interface GeneratedClip {
  id: string;
  mode: "speech" | "dialogue";
  title: string;
  textPreview: string;
  fullText: string;
  voiceSummary: string;
  voiceName: VoiceId;
  style?: string;
  dialogueSpeakers?: DialogueSpeaker[];
  dialogueLines?: DialogueLine[];
  audioBase64: string;
  mimeType: string;
  durationSec: number;
  peaks: number[];
  characterCount: number;
  createdAt: number;
}
