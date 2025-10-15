import { create } from "zustand";

const systemCrypto =
  typeof globalThis !== "undefined" && "crypto" in globalThis
    ? (globalThis.crypto as Crypto)
    : undefined;

const generateUuid = (): string => {
  if (systemCrypto?.randomUUID) {
    return systemCrypto.randomUUID();
  }
  if (systemCrypto?.getRandomValues) {
    const buffer = new Uint8Array(16);
    systemCrypto.getRandomValues(buffer);
    buffer[6] = (buffer[6] & 0x0f) | 0x40;
    buffer[8] = (buffer[8] & 0x3f) | 0x80;
    const hex = Array.from(buffer, (value) =>
      value.toString(16).padStart(2, "0")
    );
    return (
      hex.slice(0, 4).join("") +
      "-" +
      hex.slice(4, 6).join("") +
      "-" +
      hex.slice(6, 8).join("") +
      "-" +
      hex.slice(8, 10).join("") +
      "-" +
      hex.slice(10, 16).join("")
    );
  }
  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now().toString(36);
  return `env-${timestamp}-${random}`;
};

export type ClipType = "text" | "file";

export type RemoteFileInfo = {
  name: string;
  size: number;
  type: string;
  downloadUrl: string;
};

export type RemoteClipPayload = {
  text?: string | null;
  file?: RemoteFileInfo | null;
};

export type RemoteClip = {
  id: string;
  type: ClipType;
  createdAt: number;
  expiresAt: number;
  maxDownloads: number;
  downloadCount: number;
  accessCode?: string | null;
  accessToken?: string | null;
  payload: RemoteClipPayload;
  directUrl?: string | null;
};

export type ClipboardSettings = {
  persistentToken: string;
  tokenUpdatedAt: number | null;
  tokenLastUsedAt: number | null;
  environmentId: string;
};

type ClipboardStore = {
  remoteClips: RemoteClip[];
  setRemoteClips: (clips: RemoteClip[]) => void;
  upsertRemoteClip: (clip: RemoteClip) => void;
  updateRemoteClip: (clipId: string, clip: RemoteClip) => void;
  removeRemoteClip: (clipId: string) => void;
  settings: ClipboardSettings;
  updateSettings: (changes: Partial<ClipboardSettings>) => void;
};

export const useClipboardStore = create<ClipboardStore>((set) => ({
  remoteClips: [],
  setRemoteClips: (clips) =>
    set({
      remoteClips: [...clips].sort((a, b) => b.createdAt - a.createdAt)
    }),
  upsertRemoteClip: (clip) =>
    set((state) => {
      const existing = state.remoteClips.filter((item) => item.id !== clip.id);
      return {
        remoteClips: [clip, ...existing].sort(
          (a, b) => b.createdAt - a.createdAt
        )
      };
    }),
  updateRemoteClip: (clipId, clip) =>
    set((state) => ({
      remoteClips: state.remoteClips.map((item) =>
        item.id === clipId ? clip : item
      )
    })),
  removeRemoteClip: (clipId) =>
    set((state) => ({
      remoteClips: state.remoteClips.filter((item) => item.id !== clipId)
    })),
  settings: {
    persistentToken: "",
    tokenUpdatedAt: null,
    tokenLastUsedAt: null,
    environmentId: generateUuid()
  },
  updateSettings: (changes) =>
    set((state) => ({
      settings: { ...state.settings, ...changes }
    }))
}));
