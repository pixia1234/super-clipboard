import { create } from "zustand";

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
  tokenOwnerId: string | null;
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
    tokenOwnerId: null,
    environmentId: crypto.randomUUID()
  },
  updateSettings: (changes) =>
    set((state) => ({
      settings: { ...state.settings, ...changes }
    }))
}));
