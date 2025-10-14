import { ClipType, RemoteClip } from "../store/useClipboardStore";

const API_BASE = "/api";

type ApiFilePayload = {
  name: string;
  size: number;
  type: string;
  downloadUrl: string;
} | null;

type ApiClip = {
  id: string;
  type: ClipType;
  createdAt: number;
  expiresAt: number;
  maxDownloads: number;
  downloadCount: number;
  accessCode?: string | null;
  accessToken?: string | null;
  payload: {
    text?: string | null;
    file?: ApiFilePayload;
  };
  directUrl?: string | null;
};

type CreateClipPayload = {
  type: ClipType;
  expiresAt: number;
  maxDownloads: number;
  accessCode?: string;
  accessToken?: string;
  payload: {
    text?: string;
    file?: {
      name: string;
      size: number;
      type: string;
      dataUrl: string;
    };
  };
};

const request = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    let detail: unknown = null;
    try {
      detail = await response.json();
    } catch (error) {
      detail = await response.text();
    }
    const payload = typeof detail === "string" ? { message: detail } : (detail as Record<string, unknown>);
    const data = payload as { detail?: unknown; error?: unknown; message?: unknown };
    const message =
      typeof data.detail === "string"
        ? data.detail
        : typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
        ? data.message
        : "请求失败";
    const error = new Error(message);
    throw error;
  }

  return (await response.json()) as T;
};

const mapClip = (clip: ApiClip): RemoteClip => ({
  id: clip.id,
  type: clip.type,
  createdAt: clip.createdAt,
  expiresAt: clip.expiresAt,
  maxDownloads: clip.maxDownloads,
  downloadCount: clip.downloadCount,
  accessCode: clip.accessCode ?? undefined,
  accessToken: clip.accessToken ?? undefined,
  payload: {
    text: clip.payload?.text ?? null,
    file: clip.payload?.file ?? null
  },
  directUrl: clip.directUrl ?? undefined
});

export const listRemoteClips = async (): Promise<RemoteClip[]> => {
  const data = await request<{ items: ApiClip[] }>(`${API_BASE}/clips`);
  return data.items.map(mapClip);
};

export const createRemoteClip = async (
  payload: CreateClipPayload
): Promise<RemoteClip> => {
  const data = await request<ApiClip>(`${API_BASE}/clips`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return mapClip(data);
};

export const deleteRemoteClip = async (clipId: string): Promise<void> => {
  await request(`${API_BASE}/clips/${clipId}`, {
    method: "DELETE"
  });
};

export const fetchRemoteClip = async (clipId: string): Promise<RemoteClip> => {
  const data = await request<ApiClip>(`${API_BASE}/clips/${clipId}`);
  return mapClip(data);
};

export const incrementRemoteClip = async (
  clipId: string
): Promise<{ clip: RemoteClip; removed: boolean }> => {
  const data = await request<{ clip: ApiClip; removed: boolean }>(
    `${API_BASE}/clips/${clipId}/download`,
    {
      method: "POST"
    }
  );
  return {
    clip: mapClip(data.clip),
    removed: data.removed
  };
};
