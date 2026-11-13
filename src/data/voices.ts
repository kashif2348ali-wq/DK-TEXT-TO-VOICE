import {
  DialogueLine,
  DialogueSpeaker,
  StudioVoice,
  StylePreset,
} from "../types/tts";

export const STUDIO_VOICES: StudioVoice[] = [
  {
    id: "Kore",
    name: "Kore",
    gender: "Feminine",
    register: "Alto",
    timbre: "Warm & Poised",
    description:
      "Balanced studio clarity with subtle warmth and measured cadence. Excels at long-form narration, essays, and product explainers.",
    defaultStyle: "Warm, articulate studio narrator with natural phrasing",
    sampleLine:
      "Every great story begins with a single quiet observation, waiting for the right voice to bring it into the room.",
    avatarUrl: "/src/assets/images/voice_kore_portrait_1794593687196.jpg",
    bestFor: "Narration · Explainers",
  },
  {
    id: "Puck",
    name: "Puck",
    gender: "Masculine",
    register: "Tenor",
    timbre: "Bright & Expressive",
    description:
      "Energetic, conversational delivery with crisp consonants and natural levity. Built for podcasts, brand launches, and banter.",
    defaultStyle: "Upbeat, engaging podcast host with lively inflection",
    sampleLine:
      "Alright, welcome back! <laugh> You are not going to believe what we uncovered in the studio this week.",
    avatarUrl: "/src/assets/images/voice_puck_portrait_1794593687669.jpg",
    bestFor: "Podcasts · Launches",
  },
  {
    id: "Charon",
    name: "Charon",
    gender: "Masculine",
    register: "Deep Baritone",
    timbre: "Resonant & Grounded",
    description:
      "Rich low-end presence and unhurried authority. Commands documentary films, architectural briefings, and dramatic trailers.",
    defaultStyle: "Calm, resonant documentary narrator with unhurried pacing",
    sampleLine:
      "Beneath the quiet surface of the North Atlantic, currents have carried this same story for ten thousand winters.",
    avatarUrl: "/src/assets/images/voice_charon_portrait_1794593687310.jpg",
    bestFor: "Documentary · Cinema",
  },
  {
    id: "Fenrir",
    name: "Fenrir",
    gender: "Masculine",
    register: "Baritone",
    timbre: "Textured & Intimate",
    description:
      "Close-mic studio presence with realistic breath control and emotional nuance. Ideal for fiction audiobooks and character reads.",
    defaultStyle: "Close-mic, thoughtful storyteller with subtle dramatic weight",
    sampleLine:
      "I checked the corridor twice before turning the key. <breath> Even then, the silence felt like it was listening back.",
    avatarUrl: "/src/assets/images/voice_fenrir_portrait_1794593688066.jpg",
    bestFor: "Audiobooks · Drama",
  },
  {
    id: "Zephyr",
    name: "Zephyr",
    gender: "Feminine",
    register: "Soprano",
    timbre: "Airy & Crisp",
    description:
      "Effortless diction and uplifting warmth. Ideal for morning briefings, wellness guides, educational lessons, and voice interfaces.",
    defaultStyle: "Clear, reassuring broadcast host with bright pacing",
    sampleLine:
      "Good morning. Take one slow breath in before we walk through the three headlines shaping design today.",
    avatarUrl: "/src/assets/images/voice_zephyr_portrait_1794593687138.jpg",
    bestFor: "Broadcast · Guides",
  },
];

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "natural",
    label: "Natural Conversational",
    stylePrompt: "Natural, relaxed conversational tone with authentic pacing",
  },
  {
    id: "documentary",
    label: "Documentary Narrator",
    stylePrompt: "Measured, cinematic documentary narrator with quiet authority",
  },
  {
    id: "news",
    label: "Broadcast Anchor",
    stylePrompt: "Crisp, clear broadcast news anchor with steady rhythm",
  },
  {
    id: "audiobook",
    label: "Intimate Audiobook",
    stylePrompt: "Warm, close-mic literary storyteller with subtle emotional pauses",
  },
  {
    id: "podcast",
    label: "Lively Podcast Host",
    stylePrompt: "Enthusiastic, curious podcast host with expressive energy",
  },
  {
    id: "calm",
    label: "Mindful Guide",
    stylePrompt: "Gentle, unhurried breath-paced guide with soothing warmth",
  },
];

export interface SampleScript {
  id: string;
  label: string;
  voiceName: "Kore" | "Puck" | "Charon" | "Fenrir" | "Zephyr";
  style: string;
  text: string;
}

export const SAMPLE_SCRIPTS: SampleScript[] = [
  {
    id: "product-film",
    label: "Product Launch",
    voiceName: "Kore",
    style: "Warm, confident keynote narrator with clean studio poise",
    text: "Great instruments never announce themselves with noise. They feel effortless the first time you touch them. <breath> Designed from brushed aluminum and acoustic glass, every dial responds before you even finish the thought.",
  },
  {
    id: "fiction-scene",
    label: "Audiobook Scene",
    voiceName: "Fenrir",
    style: "Intimate literary narrator, hushed suspenseful tone",
    text: "The rain had stopped ten minutes ago, yet the streetlamps still burned double in the puddles. <breath> Elena paused at the iron gate, listening for footsteps that never came.",
  },
  {
    id: "morning-podcast",
    label: "Show Opener",
    voiceName: "Puck",
    style: "Energetic, smiling morning show host",
    text: "Welcome back to Studio Notes! <laugh> Seriously, grab your coffee because today we are tearing apart the myth that good sound requires a million-dollar room.",
  },
  {
    id: "documentary",
    label: "Nature Documentary",
    voiceName: "Charon",
    style: "Deep, unhurried documentary narrator with wonder",
    text: "At four thousand meters above sea level, the air thins to a whisper. Yet here, along the wind-scoured ridge, alpine pines have stood their ground for nine hundred years.",
  },
];

export interface DialogueSample {
  id: string;
  label: string;
  speakers: DialogueSpeaker[];
  lines: DialogueLine[];
}

export const DIALOGUE_SAMPLES: DialogueSample[] = [
  {
    id: "tech-podcast",
    label: "Design Podcast",
    speakers: [
      {
        id: "sp-1",
        speaker: "Alex",
        voiceName: "Puck",
        style: "Enthusiastic, bright podcast host",
      },
      {
        id: "sp-2",
        speaker: "Maya",
        voiceName: "Kore",
        style: "Thoughtful, articulate acoustic designer",
      },
    ],
    lines: [
      {
        id: "dl-1",
        speaker: "Alex",
        text: "Welcome back to Waveform! <breath> Maya, people think voice synthesis is just about pronouncing words cleanly, right?",
      },
      {
        id: "dl-2",
        speaker: "Maya",
        text: "|yeah| Exactly, and that is usually where synthetic voices give themselves away. Real speech lives in the micro-pauses and breaths.",
      },
      {
        id: "dl-3",
        speaker: "Alex",
        text: "|mhm| Like when someone laughs right before finishing a punchline? <laugh> You can hear the smile in the vowels.",
      },
      {
        id: "dl-4",
        speaker: "Maya",
        text: "That is the whole secret. Once you direct the cadence and the room feel, the script stops sounding read and starts sounding lived.",
      },
    ],
  },
  {
    id: "noir-screenplay",
    label: "Screenplay Scene",
    speakers: [
      {
        id: "sp-1",
        speaker: "Mercer",
        voiceName: "Fenrir",
        style: "Low, weary detective speaking in a quiet diner",
      },
      {
        id: "sp-2",
        speaker: "Claire",
        voiceName: "Zephyr",
        style: "Sharp, guarded informant keeping her voice low",
      },
    ],
    lines: [
      {
        id: "dl-1",
        speaker: "Mercer",
        text: "You said the ledger never left the harbor office. <breath> Yet here we are, staring at an empty safe.",
      },
      {
        id: "dl-2",
        speaker: "Claire",
        text: "I told you where it was on Tuesday, Mercer. I never promised it would wait around for you.",
      },
      {
        id: "dl-3",
        speaker: "Mercer",
        text: "<gasp> Wait—look at the ink stamp on the envelope. That is the ferry terminal.",
      },
    ],
  },
];

export const VOCAL_CUES = [
  { token: "<breath>", label: "Breath", hint: "Natural inhale pause" },
  { token: "<laugh>", label: "Laugh", hint: "Warm chuckle burst" },
  { token: "<gasp>", label: "Gasp", hint: "Sharp surprised intake" },
  { token: "|mhm|", label: "mhm", hint: "Agreeable backchannel" },
  { token: "|yeah|", label: "yeah", hint: "Conversational nod" },
];
