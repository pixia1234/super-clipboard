import { create } from "zustand";

export type ClipType = "text" | "file";

export type StoredFile = {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
};

export type RemoteClip = {
  id: string;
  type: ClipType;
  createdAt: number;
  expiresAt: number;
  accessCode?: string;
  accessToken?: string;
  payload: {
    text?: string;
    file?: StoredFile;
  };
  downloadCount: number;
};

export type CreateRemoteClip = {
  type: ClipType;
  expiresAt: number;
  text?: string;
  file?: StoredFile;
  accessCode?: string;
  accessToken?: string;
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
  addRemoteClip: (clip: CreateRemoteClip) => RemoteClip;
  removeRemoteClip: (clipId: string) => void;
  replaceRemoteClips: (clips: RemoteClip[]) => void;
  incrementDownloadCount: (clipId: string) => void;
  settings: ClipboardSettings;
  updateSettings: (changes: Partial<ClipboardSettings>) => void;
};

const buildRemoteClip = (partial: CreateRemoteClip): RemoteClip => ({
  id: crypto.randomUUID(),
  type: partial.type,
  createdAt: Date.now(),
  expiresAt: partial.expiresAt,
  accessCode: partial.accessCode,
  accessToken: partial.accessToken,
  payload: {
    text: partial.type === "text" ? partial.text ?? "" : undefined,
    file: partial.type === "file" ? partial.file : undefined
  },
  downloadCount: 0
});

export const useClipboardStore = create<ClipboardStore>((set) => ({
  remoteClips: [],
  addRemoteClip: (clip) => {
    const withId = buildRemoteClip(clip);
    set((state) => ({
      remoteClips: [withId, ...state.remoteClips].sort(
        (a, b) => b.createdAt - a.createdAt
      )
    }));
    return withId;
  },
  removeRemoteClip: (clipId) =>
    set((state) => ({
      remoteClips: state.remoteClips.filter((item) => item.id !== clipId)
    })),
  replaceRemoteClips: (clips) =>
    set({
      remoteClips: clips
    }),
  incrementDownloadCount: (clipId) =>
    set((state) => ({
      remoteClips: state.remoteClips.map((item) =>
        item.id === clipId
          ? {
              ...item,
              downloadCount: item.downloadCount + 1
            }
          : item
      )
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
