import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  useClipboardStore,
  ClipType,
  StoredFile,
  RemoteClip
} from "./store/useClipboardStore";
import { readFromClipboard, writeToClipboard } from "./utils/clipboard";
import {
  generateAccessCode,
  generateToken,
  hoursToMilliseconds,
  formatBytes
} from "./utils/generators";
import "./App.css";

type ToastState = {
  kind: "success" | "error" | "info";
  message: string;
};

const REMOTE_STORAGE_KEY = "super-clipboard::remote";
const SETTINGS_STORAGE_KEY = "super-clipboard::settings";
const MIN_EXPIRY_HOURS = 1;
const MAX_EXPIRY_HOURS = 120;
const DEFAULT_EXPIRY_HOURS = 24;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const TOKEN_EXPIRY_MS = 720 * 60 * 60 * 1000; // 720 小时

const emptyToast: ToastState | null = null;

const formatTimestamp = (timestamp: number): string =>
  new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(timestamp);

const formatRemaining = (clip: RemoteClip, now: number): string => {
  const diff = clip.expiresAt - now;
  if (diff <= 0) {
    return "已过期";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours} 小时${minutes > 0 ? ` ${minutes} 分` : ""}`;
  }
  return `${Math.max(1, minutes)} 分钟`;
};

const formatDuration = (ms: number): string => {
  if (ms <= 0) {
    return "0 分";
  }

  const totalMinutes = Math.floor(ms / (60 * 1000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    if (hours > 0) {
      return `${days} 天 ${hours} 小时`;
    }
    return `${days} 天`;
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`;
  }

  return `${Math.max(1, minutes)} 分`;
};

const clipTitle = (clip: RemoteClip): string => {
  if (clip.type === "text") {
    const text = clip.payload.text ?? "";
    if (!text) {
      return "文本片段";
    }
    const compact = text.replace(/\s+/g, " ").trim();
    return compact.length > 32 ? `${compact.slice(0, 32)}…` : compact;
  }
  return clip.payload.file?.name ?? "文件片段";
};

const App = () => {
  const {
    remoteClips,
    addRemoteClip,
    removeRemoteClip,
    replaceRemoteClips,
    incrementDownloadCount,
    settings,
    updateSettings
  } = useClipboardStore();

  const [type, setType] = useState<ClipType>("text");
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<StoredFile | null>(null);
  const [expiresInHours, setExpiresInHours] = useState(DEFAULT_EXPIRY_HOURS);
  const [shortCode, setShortCode] = useState(() => generateAccessCode());
  const [accessMode, setAccessMode] = useState<"code" | "token">(
    () => (settings.persistentToken ? "token" : "code")
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(emptyToast);
  const [isImportingClipboard, setIsImportingClipboard] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [settingsTokenDraft, setSettingsTokenDraft] = useState(
    settings.persistentToken
  );

  useEffect(() => {
    try {
      const rawRemote = window.localStorage.getItem(REMOTE_STORAGE_KEY);
      if (rawRemote) {
        const parsed = JSON.parse(rawRemote);
        if (Array.isArray(parsed)) {
          replaceRemoteClips(parsed);
        }
      }
    } catch (error) {
      console.warn("读取云端片段失败：", error);
    }

    try {
      const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings) as Partial<{
          persistentToken: unknown;
          tokenUpdatedAt: unknown;
          tokenLastUsedAt: unknown;
          tokenOwnerId: unknown;
          environmentId: unknown;
        }>;
        const sanitized = {
          persistentToken: typeof parsed.persistentToken === "string" ? parsed.persistentToken : "",
          tokenUpdatedAt:
            typeof parsed.tokenUpdatedAt === "number" ? parsed.tokenUpdatedAt : null,
          tokenLastUsedAt:
            typeof parsed.tokenLastUsedAt === "number" ? parsed.tokenLastUsedAt : null,
          tokenOwnerId: typeof parsed.tokenOwnerId === "string" ? parsed.tokenOwnerId : null,
          environmentId:
            typeof parsed.environmentId === "string" && parsed.environmentId
              ? parsed.environmentId
              : crypto.randomUUID()
        };
        updateSettings(sanitized);
      }
    } catch (error) {
      console.warn("读取环境设置失败：", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem(REMOTE_STORAGE_KEY, JSON.stringify(remoteClips));
  }, [remoteClips]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    setSettingsTokenDraft(settings.persistentToken);
  }, [settings.persistentToken]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(emptyToast), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!remoteClips.length) {
      return;
    }
    const active = remoteClips.filter((clip) => clip.expiresAt > now);
    if (active.length !== remoteClips.length) {
      replaceRemoteClips(active);
      setToast({
        kind: "info",
        message: `已自动销毁 ${remoteClips.length - active.length} 个云端片段`
      });
    }
  }, [now, remoteClips, replaceRemoteClips]);

  useEffect(() => {
    if (!settings.persistentToken) {
      return;
    }
    const reference = settings.tokenLastUsedAt ?? settings.tokenUpdatedAt;
    if (!reference) {
      return;
    }
    if (now - reference >= TOKEN_EXPIRY_MS) {
      updateSettings({
        persistentToken: "",
        tokenUpdatedAt: null,
        tokenLastUsedAt: null,
        tokenOwnerId: null
      });
      setAccessMode("code");
      setSettingsTokenDraft("");
      setToast({
        kind: "info",
        message: "持久 Token 超过 720 小时未使用，已自动销毁"
      });
    }
  }, [
    now,
    settings.persistentToken,
    settings.tokenLastUsedAt,
    settings.tokenUpdatedAt,
    updateSettings
  ]);

  useEffect(() => {
    if (!settings.persistentToken && accessMode === "token") {
      setAccessMode("code");
    }
  }, [settings.persistentToken, accessMode]);

  const hasActiveClips = useMemo(
    () => remoteClips.some((clip) => clip.expiresAt > now),
    [remoteClips, now]
  );

  const resetForm = () => {
    setTextContent("");
    setSelectedFile(null);
    setExpiresInHours(DEFAULT_EXPIRY_HOURS);
    setShortCode(generateAccessCode());
    setType("text");
    if (!settings.persistentToken) {
      setAccessMode("code");
    }
  };

  const handleImportClipboard = async () => {
    setIsImportingClipboard(true);
    const fromSystem = await readFromClipboard();
    setIsImportingClipboard(false);
    if (!fromSystem) {
      setToast({
        kind: "error",
        message: "无法读取系统剪贴板，请手动粘贴内容"
      });
      return;
    }
    setType("text");
    setTextContent(fromSystem);
    setToast({
      kind: "success",
      message: "已导入系统剪贴板内容"
    });
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setToast({
        kind: "error",
        message: "文件体积超过 50MB 限制，请压缩后重试"
      });
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSelectedFile({
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl
      });
    } catch (error) {
      console.warn("读取文件失败：", error);
      setToast({
        kind: "error",
        message: "读取文件失败，请稍后再试"
      });
    }
  };

  const handleCreateRemoteClip = () => {
    const trimmedText = textContent.trim();
    if (type === "text" && !trimmedText) {
      setToast({
        kind: "info",
        message: "请填写需要分享的文本内容"
      });
      return;
    }

    if (type === "file" && !selectedFile) {
      setToast({
        kind: "info",
        message: "请先选择需要上传的文件"
      });
      return;
    }

    if (
      Number.isNaN(expiresInHours) ||
      expiresInHours < MIN_EXPIRY_HOURS ||
      expiresInHours > MAX_EXPIRY_HOURS
    ) {
      setToast({
        kind: "info",
        message: "自动销毁时间需在 1 到 120 小时之间"
      });
      return;
    }

    const nowTs = Date.now();
    const tokenValue = settings.persistentToken.trim();
    const usingToken = accessMode === "token";
    const activeShortCode = accessMode === "code" ? shortCode.trim() : "";

    if (usingToken) {
      if (!tokenValue) {
        setToast({
          kind: "info",
          message: "请先在环境设置中配置持久 Token"
        });
        setAccessMode("code");
        return;
      }

      const reference = settings.tokenLastUsedAt ?? settings.tokenUpdatedAt;
      if (reference && nowTs - reference >= TOKEN_EXPIRY_MS) {
        updateSettings({
          persistentToken: "",
          tokenUpdatedAt: null,
          tokenLastUsedAt: null,
          tokenOwnerId: null
        });
        setAccessMode("code");
        setSettingsTokenDraft("");
        setToast({
          kind: "info",
          message: "持久 Token 超过 720 小时未使用，已自动销毁"
        });
        return;
      }

      if (settings.tokenOwnerId && settings.tokenOwnerId !== settings.environmentId) {
        setToast({
          kind: "error",
          message: "持久 Token 已被其他设备占用，无法使用"
        });
        setAccessMode("code");
        return;
      }

      if (tokenValue.length < 7) {
        setToast({
          kind: "info",
          message: "持久 Token 至少需要 7 位"
        });
        return;
      }
    } else {
      if (!/^\d{5}$/.test(activeShortCode)) {
        setToast({
          kind: "info",
          message: "直链码需为 5 位数字"
        });
        return;
      }
    }

    const created = addRemoteClip({
      type,
      expiresAt: Date.now() + hoursToMilliseconds(expiresInHours),
      text: type === "text" ? trimmedText : undefined,
      file: type === "file" ? selectedFile ?? undefined : undefined,
      accessCode: accessMode === "code" ? activeShortCode : undefined,
      accessToken: usingToken ? tokenValue : undefined
    });

    setToast({
      kind: "success",
      message: `云端${type === "text" ? "文本" : "文件"}片段已创建`
    });

    if (usingToken) {
      updateSettings({
        tokenOwnerId: settings.tokenOwnerId ?? settings.environmentId,
        tokenUpdatedAt: settings.tokenUpdatedAt ?? nowTs,
        tokenLastUsedAt: nowTs
      });
    }

    if (accessMode === "code") {
      setShortCode(generateAccessCode());
    }
    resetForm();
  };

  const handleCopyAccess = async (value: string, kind: "短码" | "Token") => {
    if (!value) {
      setToast({
        kind: "error",
        message: `当前片段没有可复制的${kind}`
      });
      return;
    }
    const ok = await writeToClipboard(value);
    setToast(
      ok
        ? { kind: "success", message: `${kind} 已复制` }
        : { kind: "error", message: `复制${kind}失败，请稍后再试` }
    );
  };

  const handleDownloadFile = (clip: RemoteClip) => {
    const file = clip.payload.file;
    if (!file) {
      setToast({
        kind: "error",
        message: "文件数据丢失，请重新上传"
      });
      return;
    }

    const link = document.createElement("a");
    link.href = file.dataUrl;
    link.download = file.name;
    link.click();

    incrementDownloadCount(clip.id);
    setToast({
      kind: "success",
      message: "文件下载已开始"
    });
  };

  const handleCopyRemoteText = async (clip: RemoteClip) => {
    const text = clip.payload.text ?? "";
    if (!text) {
      setToast({
        kind: "error",
        message: "片段内容为空"
      });
      return;
    }

    const ok = await writeToClipboard(text);
    setToast(
      ok
        ? { kind: "success", message: "文本已复制" }
        : { kind: "error", message: "复制失败，请稍后再试" }
    );
  };

  const handleRemoveRemoteClip = (clipId: string) => {
    removeRemoteClip(clipId);
    setToast({
      kind: "info",
      message: "云端片段已删除"
    });
  };

  const handleOpenSettings = () => {
    setSettingsTokenDraft(settings.persistentToken);
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    setSettingsTokenDraft(settings.persistentToken);
  };

  const handleGeneratePersistentToken = () => {
    setSettingsTokenDraft(generateToken(20));
  };

  const handleSaveSettings = () => {
    const trimmedToken = settingsTokenDraft.trim();
    if (trimmedToken && trimmedToken.length < 7) {
      setToast({
        kind: "info",
        message: "持久 Token 至少需要 7 位"
      });
      return;
    }

    const tokenChanged = settings.persistentToken !== trimmedToken;
    const nextUpdatedAt = trimmedToken
      ? tokenChanged
        ? Date.now()
        : settings.tokenUpdatedAt ?? Date.now()
      : null;
    const nextLastUsed = trimmedToken && !tokenChanged ? settings.tokenLastUsedAt : null;
    const nextOwnerId = trimmedToken
      ? tokenChanged
        ? settings.environmentId
        : settings.tokenOwnerId ?? settings.environmentId
      : null;

    updateSettings({
      persistentToken: trimmedToken,
      tokenUpdatedAt: nextUpdatedAt,
      tokenLastUsedAt: nextLastUsed,
      tokenOwnerId: nextOwnerId
    });

    if (!trimmedToken) {
      setAccessMode("code");
    }

    setSettingsTokenDraft(trimmedToken);
    setToast({
      kind: "success",
      message: "环境设置已保存"
    });
    setIsSettingsOpen(false);
  };

  const tokenReferenceTime = settings.tokenLastUsedAt ?? settings.tokenUpdatedAt;
  const tokenLastActivityLabel = settings.persistentToken
    ? settings.tokenLastUsedAt
      ? `最近使用：${formatTimestamp(settings.tokenLastUsedAt)}`
      : settings.tokenUpdatedAt
      ? `设置时间：${formatTimestamp(settings.tokenUpdatedAt)}`
      : null
    : null;
  const tokenExpiryNotice =
    settings.persistentToken && tokenReferenceTime
      ? `距离自动销毁：${formatDuration(
          Math.max(0, TOKEN_EXPIRY_MS - (now - tokenReferenceTime))
        )}`
      : null;

  return (
    <div>
      <header className="hero">
        <div className="hero__top">
          <div className="hero__badge">Super Clipboard</div>
          <button
            type="button"
            className="btn btn--ghost settings-trigger"
            onClick={handleOpenSettings}
          >
            环境设置
          </button>
        </div>
        <h1>专注云端直链的超级剪贴板</h1>
        <p>
          面向 VNC、内网穿透与跨设备传输场景。生成短码或持久 Token，即可按时限访问文本与文件。
        </p>
      </header>

      <main className="container">
        <section className="card">
          <div className="card__header">
            <div>
              <h2>创建云端片段</h2>
              <p className="muted">
                录入文本或上传最多 50MB 的文件，生成短码 / 持久 Token 并设置自动销毁。
              </p>
            </div>
            <div className="card__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleImportClipboard}
                disabled={isImportingClipboard || type !== "text"}
                title={
                  type === "text"
                    ? "读取系统剪贴板内容"
                    : "切换到文本类型以导入系统剪贴板"
                }
              >
                {isImportingClipboard ? "读取中..." : "导入系统剪贴板"}
              </button>
            </div>
          </div>

          <div className="remote-form">
            <div className="remote-form__split">
              <div className="stack">
                <div className="field field--horizontal">
                  <span className="field__label">内容类型</span>
                  <div className="pill-group">
                    <button
                      type="button"
                      className={`pill ${type === "text" ? "pill--active" : ""}`}
                      onClick={() => setType("text")}
                    >
                      文本片段
                    </button>
                    <button
                      type="button"
                      className={`pill ${type === "file" ? "pill--active" : ""}`}
                      onClick={() => setType("file")}
                    >
                      文件上传
                    </button>
                  </div>
                </div>

                {type === "text" ? (
                  <label className="field">
                    <span className="field__label">文本内容</span>
                    <textarea
                      value={textContent}
                      onChange={(event) => setTextContent(event.target.value)}
                      placeholder="将需要分享的文本粘贴到这里。"
                      rows={6}
                    />
                  </label>
                ) : (
                  <label className="field">
                    <span className="field__label">文件</span>
                    <input type="file" onChange={handleFileSelect} accept="*" />
                    {selectedFile ? (
                      <div className="file-preview">
                        <span className="file-preview__name">
                          {selectedFile.name}
                        </span>
                        <span className="file-preview__meta">
                          {formatBytes(selectedFile.size)} ·{" "}
                          {selectedFile.type || "未知类型"}
                        </span>
                      </div>
                    ) : (
                      <p className="muted">支持任意类型，大小不超过 50MB。</p>
                    )}
                  </label>
                )}
              </div>

              <div className="stack">
                <label className="field">
                  <span className="field__label">自动销毁时间（小时）</span>
                  <input
                    type="number"
                    min={MIN_EXPIRY_HOURS}
                    max={MAX_EXPIRY_HOURS}
                    value={expiresInHours}
                    onChange={(event) => setExpiresInHours(Number(event.target.value))}
                  />
                  <span className="field__hint">
                    {MIN_EXPIRY_HOURS}-{MAX_EXPIRY_HOURS} 小时，到期自动清理。
                  </span>
                </label>

                <fieldset className="field field--group">
                  <legend className="field__label">访问凭证</legend>
                  <label className="radio">
                    <input
                      type="radio"
                      name="access-mode"
                      value="code"
                      checked={accessMode === "code"}
                      onChange={() => setAccessMode("code")}
                    />
                    <div className="radio__content">
                      <span>使用 5 位直链码</span>
                      <div className="radio__inline">
                        <strong className="code">{shortCode}</strong>
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => setShortCode(generateAccessCode())}
                          disabled={accessMode !== "code"}
                        >
                          刷新
                        </button>
                      </div>
                    </div>
                  </label>

                  <label
                    className={`radio ${settings.persistentToken ? "" : "radio--disabled"}`}
                  >
                    <input
                      type="radio"
                      name="access-mode"
                      value="token"
                      checked={accessMode === "token"}
                      onChange={() => setAccessMode("token")}
                      disabled={!settings.persistentToken}
                    />
                    <div className="radio__content">
                      <span>使用持久 Token</span>
                      {settings.persistentToken ? (
                        <span className="code code--inline">
                          {settings.persistentToken}
                        </span>
                      ) : (
                        <span className="muted small">
                          请先配置持久 Token
                        </span>
                      )}
                      {settings.persistentToken && tokenExpiryNotice ? (
                        <span className="settings-meta">{tokenExpiryNotice}</span>
                      ) : null}
                    </div>
                  </label>
                </fieldset>

                <button
                  type="button"
                  className="btn btn--secondary btn--full"
                  onClick={handleCreateRemoteClip}
                >
                  创建云端片段
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <h2>云端片段列表</h2>
              <p className="muted">
                {remoteClips.length
                  ? hasActiveClips
                    ? `共有 ${remoteClips.length} 个片段，过期后自动销毁。`
                    : "全部片段均已过期或销毁。"
                  : "尚未创建云端片段。"}
              </p>
            </div>
          </div>

          <div className="grid">
            {remoteClips.map((clip) => {
              const expired = clip.expiresAt <= now;
              return (
                <article
                  key={clip.id}
                  className={`remote-card ${expired ? "remote-card--expired" : ""}`}
                >
                  <header className="remote-card__header">
                    <div>
                      <h4>{clipTitle(clip)}</h4>
                      <span className="muted small">
                        {formatTimestamp(clip.createdAt)} 创建 ·{" "}
                        {clip.type === "text" ? "文本片段" : "文件片段"}
                      </span>
                    </div>
                    <span
                      className={`badge ${
                        expired
                          ? "badge--danger"
                          : clip.expiresAt - now <= 60 * 60 * 1000
                          ? "badge--warning"
                          : "badge--ok"
                      }`}
                    >
                      {expired ? "已销毁" : `剩余 ${formatRemaining(clip, now)}`}
                    </span>
                  </header>

                  <div className="remote-card__body">
                    {clip.type === "text" ? (
                      <pre className="remote-card__content">
                        {clip.payload.text}
                      </pre>
                    ) : clip.payload.file ? (
                      <div className="file-preview">
                        <span className="file-preview__name">
                          {clip.payload.file.name}
                        </span>
                        <span className="file-preview__meta">
                          {formatBytes(clip.payload.file.size)} ·{" "}
                          {clip.payload.file.type || "未知类型"}
                        </span>
                        <span className="file-preview__meta">
                          下载次数：{clip.downloadCount}
                        </span>
                      </div>
                    ) : (
                      <span className="muted">文件数据不可用，请重新上传。</span>
                    )}
                  </div>

                  <footer className="remote-card__footer">
                    <div className="remote-card__creds">
                      {clip.accessCode ? (
                        <button
                          type="button"
                          className="badge badge--ghost"
                          onClick={() =>
                            handleCopyAccess(clip.accessCode ?? "", "短码")
                          }
                        >
                          直链码：{clip.accessCode}
                        </button>
                      ) : null}
                      {clip.accessToken ? (
                        <button
                          type="button"
                          className="badge badge--ghost"
                          onClick={() =>
                            handleCopyAccess(clip.accessToken ?? "", "Token")
                          }
                        >
                          Token：{clip.accessToken}
                        </button>
                      ) : null}
                    </div>
                    <div className="remote-card__actions">
                      {clip.type === "text" ? (
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => handleCopyRemoteText(clip)}
                          disabled={expired}
                        >
                          复制文本
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--tiny"
                          onClick={() => handleDownloadFile(clip)}
                          disabled={expired}
                        >
                          下载文件
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--tiny btn--danger"
                        onClick={() => handleRemoveRemoteClip(clip.id)}
                      >
                        删除
                      </button>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {isSettingsOpen ? (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__overlay" onClick={handleCloseSettings} />
          <div className="modal__content">
            <header className="modal__header">
              <div>
                <h3>环境设置</h3>
                <p className="muted small">
                  配置持久 Token，创建片段时自动复用。
                </p>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--tiny"
                onClick={handleCloseSettings}
              >
                关闭
              </button>
            </header>

            <div className="stack">
              <label className="field">
                <span className="field__label">持久 Token</span>
                <div className="field field--compact">
                  <input
                    value={settingsTokenDraft}
                    onChange={(event) => setSettingsTokenDraft(event.target.value)}
                    placeholder="至少 7 位，推荐混合字母数字"
                  />
                  <button
                    type="button"
                    className="btn btn--tiny"
                    onClick={handleGeneratePersistentToken}
                  >
                    自动生成
                  </button>
                </div>
                <span className="field__hint">
                  云端片段可复用该 Token 进行持久访问，720 小时未使用会自动销毁。
                </span>
              </label>
              {tokenLastActivityLabel ? (
                <p className="settings-meta">{tokenLastActivityLabel}</p>
              ) : null}
              {settings.persistentToken && tokenExpiryNotice ? (
                <p className="settings-meta">{tokenExpiryNotice}</p>
              ) : null}
            </div>

            <div className="settings-actions settings-actions--modal">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleSaveSettings}
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <aside className={`toast toast--${toast.kind}`}>
          <span>{toast.message}</span>
        </aside>
      ) : null}
    </div>
  );
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export default App;
