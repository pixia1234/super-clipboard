export type Locale = "zh-CN" | "en" | "ja";

export type TranslationValue =
  | string
  | ((params?: Record<string, unknown>) => string);

export type TranslationDictionary = Record<string, TranslationValue>;

export const defaultLocale: Locale = "zh-CN";

type RangeParams = { min: number; max: number };
type ValueParams = { value: number };
type TargetParams = { target: string };
type DurationParams = { duration: string };
type TimestampParams = { timestamp: string };
type CountParams = { count: number };
type CountMaxParams = { count: number; max: number };
type ClipMetaParams = { created: string; type: string };
type CodeParams = { code: string };
type TokenParams = { token: string };
type DaysHoursParams = { days: number; hours: number };
type DaysParams = { days: number };
type HoursMinutesParams = { hours: number; minutes: number };
type HoursParams = { hours: number };
type MinutesParams = { minutes: number };
type ReasonParams = { reason: string };

const toRange = (params?: Record<string, unknown>): RangeParams => {
  const { min = 0, max = 0 } = (params ?? {}) as Partial<RangeParams>;
  return { min, max };
};

const toValue = (params?: Record<string, unknown>): ValueParams => {
  const { value = 0 } = (params ?? {}) as Partial<ValueParams>;
  return { value };
};

const toTarget = (params?: Record<string, unknown>): TargetParams => {
  const { target = "" } = (params ?? {}) as Partial<TargetParams>;
  return { target };
};

const toDuration = (params?: Record<string, unknown>): DurationParams => {
  const { duration = "" } = (params ?? {}) as Partial<DurationParams>;
  return { duration };
};

const toTimestamp = (params?: Record<string, unknown>): TimestampParams => {
  const { timestamp = "" } = (params ?? {}) as Partial<TimestampParams>;
  return { timestamp };
};

const toCount = (params?: Record<string, unknown>): CountParams => {
  const { count = 0 } = (params ?? {}) as Partial<CountParams>;
  return { count };
};

const toCountMax = (params?: Record<string, unknown>): CountMaxParams => {
  const { count = 0, max = 0 } = (params ?? {}) as Partial<CountMaxParams>;
  return { count, max };
};

const toClipMeta = (params?: Record<string, unknown>): ClipMetaParams => {
  const { created = "", type = "" } = (params ?? {}) as Partial<ClipMetaParams>;
  return { created, type };
};

const toCode = (params?: Record<string, unknown>): CodeParams => {
  const { code = "" } = (params ?? {}) as Partial<CodeParams>;
  return { code };
};

const toToken = (params?: Record<string, unknown>): TokenParams => {
  const { token = "" } = (params ?? {}) as Partial<TokenParams>;
  return { token };
};

const toDaysHours = (params?: Record<string, unknown>): DaysHoursParams => {
  const { days = 0, hours = 0 } = (params ?? {}) as Partial<DaysHoursParams>;
  return { days, hours };
};

const toDays = (params?: Record<string, unknown>): DaysParams => {
  const { days = 0 } = (params ?? {}) as Partial<DaysParams>;
  return { days };
};

const toHoursMinutes = (params?: Record<string, unknown>): HoursMinutesParams => {
  const { hours = 0, minutes = 0 } = (params ?? {}) as Partial<HoursMinutesParams>;
  return { hours, minutes };
};

const toHours = (params?: Record<string, unknown>): HoursParams => {
  const { hours = 0 } = (params ?? {}) as Partial<HoursParams>;
  return { hours };
};

const toMinutes = (params?: Record<string, unknown>): MinutesParams => {
  const { minutes = 0 } = (params ?? {}) as Partial<MinutesParams>;
  return { minutes };
};

const toReason = (params?: Record<string, unknown>): ReasonParams => {
  const { reason = "" } = (params ?? {}) as Partial<ReasonParams>;
  return { reason: String(reason) };
};

const zhCN: TranslationDictionary = {
  "language.zhCN": "中文（简体）",
  "language.en": "English",
  "language.ja": "日本語",
  "locale.switcherLabel": "界面语言",

  "hero.title": "专注云端直链的超级剪贴板",
  "hero.subtitle":
    "分享文本或文件，支持短码与持久 Token，灵活控制访问次数与自动销毁策略。",
  "hero.settings": "环境设置",

  "create.title": "创建云端剪贴板",
  "create.description": "录入文本或上传最多 50MB 的文件，生成短码或持久 Token 并配置自动销毁策略。",

  "buttons.importClipboard": "导入系统剪贴板",
  "buttons.importingClipboard": "读取中...",
  "buttons.refresh": "刷新",
  "buttons.create": "创建云端剪贴板",
  "buttons.creating": "创建中...",
  "buttons.copyText": "复制文本",
  "buttons.downloadFile": "下载文件",
  "buttons.delete": "删除",
  "buttons.saveSettings": "保存设置",
  "buttons.close": "关闭",
  "buttons.generateToken": "自动生成",

  "form.contentType": "内容类型",
  "form.textType": "文本片段",
  "form.fileType": "文件上传",
  "form.textLabel": "文本内容",
  "form.textPlaceholder": "将需要分享的文本粘贴到这里。",
  "form.fileLabel": "文件",
  "form.fileSupport": "支持任意类型，大小不超过 50MB。",
  "form.unknownType": "未知类型",
  "form.expiryHoursLabel": "自动销毁时间（小时）",
  "form.expiryHint": (params) => {
    const { min, max } = toRange(params);
    return `${min}-${max} 小时，到期自动清理。`;
  },
  "form.maxDownloadsLabel": "访问次数上限",
  "form.maxDownloadsOption": (params) => {
    const { value } = toValue(params);
    return `${value} 次`;
  },
  "form.maxDownloadsHint": (params) => {
    const { value } = toValue(params);
    return `默认 ${value} 次，达到次数后自动销毁。`;
  },
  "form.accessCredential": "访问凭证",
  "form.accessWithCode": "使用 5 位直链码",
  "form.accessWithToken": "使用持久 Token",
  "form.tokenMissing": "请先配置持久 Token",

  "access.directLink": "访问直链",
  "access.token": "Token",

  "toast.loadFailed": "获取云端剪贴板失败，请稍后重试",
  "toast.tokenExpired": "持久 Token 超过 720 小时未使用，已自动销毁",
  "toast.clipboardReadFailed": "无法读取系统剪贴板，请手动粘贴内容",
  "toast.clipboardImported": "已导入系统剪贴板内容",
  "toast.fileTooLarge": "文件体积超过 50MB 限制，请压缩后重试",
  "toast.fileReadFailed": "读取文件失败，请稍后再试",
  "toast.textRequired": "请填写需要分享的文本内容",
  "toast.fileRequired": "请先选择需要上传的文件",
  "toast.expiryInvalid": "自动销毁时间需在 1 到 120 小时之间",
  "toast.downloadLimitInvalid": "单个剪贴板的访问次数需在 1 到 500 次之间",
  "toast.tokenRequired": "请先在环境设置中配置持久 Token",
  "toast.tokenInUse": "持久 Token 已被其他设备占用，无法使用",
  "toast.tokenTooShort": "持久 Token 至少需要 7 位",
  "toast.shortCodeInvalid": "直链码需为 5 位数字",
  "toast.createSuccess.text": "云端文本剪贴板已创建",
  "toast.createSuccess.file": "云端文件剪贴板已创建",
  "toast.createFailed": "创建失败，请稍后重试",
  "toast.tokenRegisterFailed": (params) => {
    const { reason } = toReason(params);
    return `持久 Token 保存失败：${reason}`;
  },
  "toast.tokenRegisterFailedFallback": "持久 Token 保存失败，请稍后重试",
  "toast.noAccessValue": (params) => {
    const { target } = toTarget(params);
    return `当前剪贴板没有可复制的${target}`;
  },
  "toast.copySuccess": (params) => {
    const { target } = toTarget(params);
    return `${target} 已复制`;
  },
  "toast.copyFailed": (params) => {
    const { target } = toTarget(params);
    return `复制${target}失败，请稍后再试`;
  },
  "toast.clipAutoDeleted": "剪贴板已自动销毁",
  "toast.fileMissing": "文件数据丢失，请重新上传",
  "toast.fileDownloadStarted": "文件下载已开始",
  "toast.clipEmpty": "剪贴板内容为空",
  "toast.clipDeleted": "云端剪贴板已删除",
  "toast.settingsSaved": "环境设置已保存",
  "toast.removeFailed": "删除失败，请稍后再试",

  "time.expired": "已过期",
  "time.daysHours": (params) => {
    const { days, hours } = toDaysHours(params);
    return `${days} 天 ${hours} 小时`;
  },
  "time.daysOnly": (params) => {
    const { days } = toDays(params);
    return `${days} 天`;
  },
  "time.hoursMinutes": (params) => {
    const { hours, minutes } = toHoursMinutes(params);
    return minutes > 0 ? `${hours} 小时 ${minutes} 分` : `${hours} 小时`;
  },
  "time.hoursOnly": (params) => {
    const { hours } = toHours(params);
    return `${hours} 小时`;
  },
  "time.minutesOnly": (params) => {
    const { minutes } = toMinutes(params);
    return `${minutes} 分钟`;
  },
  "time.zeroMinutes": "0 分",

  "token.expiryNotice": (params) => {
    const { duration } = toDuration(params);
    return `距离自动销毁：${duration}`;
  },
  "token.lastUsed": (params) => {
    const { timestamp } = toTimestamp(params);
    return `最近使用：${timestamp}`;
  },
  "token.updatedAt": (params) => {
    const { timestamp } = toTimestamp(params);
    return `设置时间：${timestamp}`;
  },

  "list.title": "云端剪贴板列表",
  "list.summaryActive": (params) => {
    const { count } = toCount(params);
    return `共有 ${count} 个项目，过期后自动销毁。`;
  },
  "list.summaryAllInactive": "全部项目均已过期或销毁。",
  "list.summaryEmpty": "尚未创建云端剪贴板。",
  "list.badge.limitReached": "已达上限",
  "list.badge.expired": "已过期",
  "list.badge.remaining": (params) => {
    const { duration } = toDuration(params);
    return `剩余 ${duration}`;
  },
  "list.clipMeta": (params) => {
    const { created, type } = toClipMeta(params);
    return `${created} 创建 · ${type}`;
  },
  "list.clipType.text": "文本片段",
  "list.clipType.file": "文件片段",
  "list.fileMeta.downloads": (params) => {
    const { count, max } = toCountMax(params);
    return `下载次数：${count} / ${max}`;
  },
  "list.fileUnavailable": "文件数据不可用，请重新上传。",
  "list.remainingDownloads": (params) => {
    const { count } = toCount(params);
    return `剩余访问次数：${count}`;
  },
  "list.codeLabel": (params) => {
    const { code } = toCode(params);
    return `直链码：${code}`;
  },
  "list.tokenLabel": (params) => {
    const { token } = toToken(params);
    return `Token：${token}`;
  },

  "modal.title": "环境设置",
  "modal.description": "配置持久 Token，创建剪贴板时自动复用。",
  "modal.tokenLabel": "持久 Token",
  "modal.tokenPlaceholder": "至少 7 位，推荐混合字母数字",
  "modal.tokenHint":
    "云端剪贴板可复用该 Token 进行持久访问，720 小时未使用会自动销毁。",

  "tooltip.importClipboard": "读取系统剪贴板内容",
  "tooltip.switchToText": "切换到文本类型以导入系统剪贴板",

  "copy.target.directLink": "访问直链",
  "copy.target.token": "Token",
  "copy.target.text": "文本",
  "copy.target.file": "文件"
};

const en: TranslationDictionary = {
  "language.zhCN": "Chinese (Simplified)",
  "language.en": "English",
  "language.ja": "Japanese",
  "locale.switcherLabel": "Language",

  "hero.title": "Super Clipboard for Direct Links",
  "hero.subtitle":
    "Share text or files with short codes or persistent tokens, set download limits, and expire links automatically.",
  "hero.settings": "Settings",

  "buttons.importClipboard": "Import from clipboard",
  "buttons.importingClipboard": "Reading…",
  "buttons.refresh": "Refresh",
  "buttons.create": "Create cloud clipboard",
  "buttons.creating": "Creating…",

  "create.title": "Create cloud clipboard",
  "create.description": "Add text or upload files up to 50 MB, generate short codes or persistent tokens, and configure auto-destroy policies.",
  "buttons.copyText": "Copy text",
  "buttons.downloadFile": "Download file",
  "buttons.delete": "Delete",
  "buttons.saveSettings": "Save settings",
  "buttons.close": "Close",
  "buttons.generateToken": "Generate",

  "form.contentType": "Content type",
  "form.textType": "Text snippet",
  "form.fileType": "File upload",
  "form.textLabel": "Text content",
  "form.textPlaceholder": "Paste the content you want to share.",
  "form.fileLabel": "File",
  "form.fileSupport": "Any file type is supported (max 50 MB).",
  "form.unknownType": "Unknown type",
  "form.expiryHoursLabel": "Auto-destroy after (hours)",
  "form.expiryHint": (params) => {
    const { min, max } = toRange(params);
    return `${min}-${max} hours, cleaned up automatically.`;
  },
  "form.maxDownloadsLabel": "Download limit",
  "form.maxDownloadsOption": (params) => {
    const { value } = toValue(params);
    return `${value} times`;
  },
  "form.maxDownloadsHint": (params) => {
    const { value } = toValue(params);
    return `Default ${value} times. The clipboard self-destructs after the limit.`;
  },
  "form.accessCredential": "Access credential",
  "form.accessWithCode": "Use a 5-digit short code",
  "form.accessWithToken": "Use persistent token",
  "form.tokenMissing": "Configure a persistent token first",

  "access.directLink": "direct link",
  "access.token": "token",

  "toast.loadFailed": "Failed to fetch cloud clipboards. Please try again later.",
  "toast.tokenExpired":
    "Persistent token hasn’t been used for 720 hours and has been cleared automatically.",
  "toast.clipboardReadFailed":
    "Clipboard cannot be read. Please paste the content manually.",
  "toast.clipboardImported": "System clipboard content imported.",
  "toast.fileTooLarge": "File exceeds the 50 MB limit. Please compress and retry.",
  "toast.fileReadFailed": "Failed to read the file. Please try again later.",
  "toast.textRequired": "Enter the text you want to share.",
  "toast.fileRequired": "Select a file to upload.",
  "toast.expiryInvalid": "Auto-destroy time must be between 1 and 120 hours.",
  "toast.downloadLimitInvalid":
    "Download limit must be between 1 and 500 per clipboard.",
  "toast.tokenRequired": "Configure a persistent token in settings first.",
  "toast.tokenInUse": "The persistent token is already in use on another device.",
  "toast.tokenTooShort": "Persistent token must be at least 7 characters.",
  "toast.shortCodeInvalid": "Short code must be exactly 5 digits.",
  "toast.createSuccess.text": "Text clipboard created.",
  "toast.createSuccess.file": "File clipboard created.",
  "toast.createFailed": "Creation failed. Please try again later.",
  "toast.tokenRegisterFailed": (params) => {
    const { reason } = toReason(params);
    return `Failed to save persistent token: ${reason}`;
  },
  "toast.tokenRegisterFailedFallback":
    "Failed to save persistent token. Please try again later.",
  "toast.noAccessValue": (params) => {
    const { target } = toTarget(params);
    return `No ${target} available to copy.`;
  },
  "toast.copySuccess": (params) => {
    const { target } = toTarget(params);
    return `${target} copied.`;
  },
  "toast.copyFailed": (params) => {
    const { target } = toTarget(params);
    return `Could not copy ${target}. Please try again.`;
  },
  "toast.clipAutoDeleted": "Clipboard has been destroyed automatically.",
  "toast.fileMissing": "File data is missing. Please upload again.",
  "toast.fileDownloadStarted": "File download started.",
  "toast.clipEmpty": "Clipboard is empty.",
  "toast.clipDeleted": "Cloud clipboard deleted.",
  "toast.settingsSaved": "Settings saved.",
  "toast.removeFailed": "Delete failed. Please try again later.",

  "time.expired": "Expired",
  "time.daysHours": (params) => {
    const { days, hours } = toDaysHours(params);
    return `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
  },
  "time.daysOnly": (params) => {
    const { days } = toDays(params);
    return `${days} day${days === 1 ? "" : "s"}`;
  },
  "time.hoursMinutes": (params) => {
    const { hours, minutes } = toHoursMinutes(params);
    return minutes > 0
      ? `${hours} hour${hours === 1 ? "" : "s"} ${minutes} min`
      : `${hours} hour${hours === 1 ? "" : "s"}`;
  },
  "time.hoursOnly": (params) => {
    const { hours } = toHours(params);
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  },
  "time.minutesOnly": (params) => {
    const { minutes } = toMinutes(params);
    return `${minutes} min`;
  },
  "time.zeroMinutes": "0 min",

  "token.expiryNotice": (params) => {
    const { duration } = toDuration(params);
    return `Auto-destroy in: ${duration}`;
  },
  "token.lastUsed": (params) => {
    const { timestamp } = toTimestamp(params);
    return `Last used: ${timestamp}`;
  },
  "token.updatedAt": (params) => {
    const { timestamp } = toTimestamp(params);
    return `Configured at: ${timestamp}`;
  },

  "list.title": "Cloud clipboards",
  "list.summaryActive": (params) => {
    const { count } = toCount(params);
    return `${count} item${count === 1 ? "" : "s"} active, auto-destroy after expiry.`;
  },
  "list.summaryAllInactive": "All clipboards have expired or been destroyed.",
  "list.summaryEmpty": "No cloud clipboards yet.",
  "list.badge.limitReached": "Limit reached",
  "list.badge.expired": "Expired",
  "list.badge.remaining": (params) => {
    const { duration } = toDuration(params);
    return `Remaining ${duration}`;
  },
  "list.clipMeta": (params) => {
    const { created, type } = toClipMeta(params);
    return `${created} · ${type}`;
  },
  "list.clipType.text": "Text clipboard",
  "list.clipType.file": "File clipboard",
  "list.fileMeta.downloads": (params) => {
    const { count, max } = toCountMax(params);
    return `Downloads: ${count} / ${max}`;
  },
  "list.fileUnavailable": "File data unavailable. Please re-upload.",
  "list.remainingDownloads": (params) => {
    const { count } = toCount(params);
    return `Remaining downloads: ${count}`;
  },
  "list.codeLabel": (params) => {
    const { code } = toCode(params);
    return `Short code: ${code}`;
  },
  "list.tokenLabel": (params) => {
    const { token } = toToken(params);
    return `Token: ${token}`;
  },

  "modal.title": "Environment settings",
  "modal.description":
    "Configure a persistent token to reuse it when creating clipboards.",
  "modal.tokenLabel": "Persistent token",
  "modal.tokenPlaceholder": "At least 7 characters. Mix letters and numbers.",
  "modal.tokenHint":
    "Cloud clipboards can reuse this token. It will be removed after 720 hours of inactivity.",

  "tooltip.importClipboard": "Read from system clipboard",
  "tooltip.switchToText": "Switch to text mode to import from clipboard",

  "copy.target.directLink": "direct link",
  "copy.target.token": "token",
  "copy.target.text": "text",
  "copy.target.file": "file"
};

const ja: TranslationDictionary = {
  "language.zhCN": "中国語（簡体字）",
  "language.en": "英語",
  "language.ja": "日本語",
  "locale.switcherLabel": "表示言語",

  "hero.title": "直リンクに特化したスーパークリップボード",
  "hero.subtitle":
    "テキストやファイルを短いコードや永続トークンで共有し、ダウンロード回数と自動削除を柔軟に設定できます。",
  "hero.settings": "環境設定",

  "buttons.importClipboard": "クリップボードを読み込む",
  "buttons.importingClipboard": "読み込み中…",
  "buttons.refresh": "更新",
  "buttons.create": "クラウドクリップボードを作成",
  "buttons.creating": "作成中…",

  "create.title": "クラウドクリップボードを作成",
  "create.description": "最大 50 MB のテキストまたはファイルを登録し、ショートコードや永続トークン、自動削除ルールを設定できます。",
  "buttons.copyText": "テキストをコピー",
  "buttons.downloadFile": "ファイルをダウンロード",
  "buttons.delete": "削除",
  "buttons.saveSettings": "設定を保存",
  "buttons.close": "閉じる",
  "buttons.generateToken": "自動生成",

  "form.contentType": "コンテンツの種類",
  "form.textType": "テキスト",
  "form.fileType": "ファイル",
  "form.textLabel": "テキスト内容",
  "form.textPlaceholder": "共有したいテキストを貼り付けてください。",
  "form.fileLabel": "ファイル",
  "form.fileSupport": "すべての形式に対応（最大 50 MB）。",
  "form.unknownType": "不明な形式",
  "form.expiryHoursLabel": "自動削除まで（時間）",
  "form.expiryHint": (params) => {
    const { min, max } = toRange(params);
    return `${min}〜${max} 時間で自動削除します。`;
  },
  "form.maxDownloadsLabel": "ダウンロード上限",
  "form.maxDownloadsOption": (params) => {
    const { value } = toValue(params);
    return `${value} 回`;
  },
  "form.maxDownloadsHint": (params) => {
    const { value } = toValue(params);
    return `初期値は ${value} 回です。上限に達すると自動的に削除されます。`;
  },
  "form.accessCredential": "アクセス認証",
  "form.accessWithCode": "5 桁のショートコードを使用",
  "form.accessWithToken": "永続トークンを使用",
  "form.tokenMissing": "先に永続トークンを設定してください",

  "access.directLink": "ダイレクトリンク",
  "access.token": "トークン",

  "toast.loadFailed": "クラウドクリップボードの取得に失敗しました。時間をおいて再試行してください。",
  "toast.tokenExpired":
    "永続トークンは 720 時間使用されていないため、自動的に削除されました。",
  "toast.clipboardReadFailed":
    "システムのクリップボードを読み取れません。手動で貼り付けてください。",
  "toast.clipboardImported": "クリップボードの内容を取り込みました。",
  "toast.fileTooLarge": "ファイルが 50 MB を超えています。圧縮してから再試行してください。",
  "toast.fileReadFailed": "ファイルの読み込みに失敗しました。後でもう一度お試しください。",
  "toast.textRequired": "共有するテキストを入力してください。",
  "toast.fileRequired": "アップロードするファイルを選択してください。",
  "toast.expiryInvalid": "自動削除の時間は 1〜120 時間の範囲で指定してください。",
  "toast.downloadLimitInvalid":
    "各クリップボードのダウンロード上限は 1〜500 回の範囲で指定してください。",
  "toast.tokenRequired": "まず環境設定で永続トークンを設定してください。",
  "toast.tokenInUse": "永続トークンは別のデバイスで使用中です。",
  "toast.tokenTooShort": "永続トークンは 7 文字以上で指定してください。",
  "toast.shortCodeInvalid": "ショートコードは 5 桁の数字で指定してください。",
  "toast.createSuccess.text": "テキストのクリップボードを作成しました。",
  "toast.createSuccess.file": "ファイルのクリップボードを作成しました。",
  "toast.createFailed": "作成に失敗しました。時間をおいて再試行してください。",
  "toast.tokenRegisterFailed": (params) => {
    const { reason } = toReason(params);
    return `永続トークンの保存に失敗しました: ${reason}`;
  },
  "toast.tokenRegisterFailedFallback":
    "永続トークンの保存に失敗しました。時間をおいて再試行してください。",
  "toast.noAccessValue": (params) => {
    const { target } = toTarget(params);
    return `コピーできる ${target} がありません。`;
  },
  "toast.copySuccess": (params) => {
    const { target } = toTarget(params);
    return `${target} をコピーしました。`;
  },
  "toast.copyFailed": (params) => {
    const { target } = toTarget(params);
    return `${target} をコピーできませんでした。時間をおいて再試行してください。`;
  },
  "toast.clipAutoDeleted": "クリップボードは自動的に削除されました。",
  "toast.fileMissing": "ファイルデータが見つかりません。再度アップロードしてください。",
  "toast.fileDownloadStarted": "ファイルのダウンロードを開始しました。",
  "toast.clipEmpty": "クリップボードは空です。",
  "toast.clipDeleted": "クラウドクリップボードを削除しました。",
  "toast.settingsSaved": "設定を保存しました。",
  "toast.removeFailed": "削除に失敗しました。時間をおいて再試行してください。",

  "time.expired": "期限切れ",
  "time.daysHours": (params) => {
    const { days, hours } = toDaysHours(params);
    return `${days} 日 ${hours} 時間`;
  },
  "time.daysOnly": (params) => {
    const { days } = toDays(params);
    return `${days} 日`;
  },
  "time.hoursMinutes": (params) => {
    const { hours, minutes } = toHoursMinutes(params);
    return minutes > 0 ? `${hours} 時間 ${minutes} 分` : `${hours} 時間`;
  },
  "time.hoursOnly": (params) => {
    const { hours } = toHours(params);
    return `${hours} 時間`;
  },
  "time.minutesOnly": (params) => {
    const { minutes } = toMinutes(params);
    return `${minutes} 分`;
  },
  "time.zeroMinutes": "0 分",

  "token.expiryNotice": (params) => {
    const { duration } = toDuration(params);
    return `自動削除まで: ${duration}`;
  },
  "token.lastUsed": (params) => {
    const { timestamp } = toTimestamp(params);
    return `最終使用: ${timestamp}`;
  },
  "token.updatedAt": (params) => {
    const { timestamp } = toTimestamp(params);
    return `設定時刻: ${timestamp}`;
  },

  "list.title": "クラウドクリップボード",
  "list.summaryActive": (params) => {
    const { count } = toCount(params);
    return `合計 ${count} 件。期限到達後は自動的に削除されます。`;
  },
  "list.summaryAllInactive": "すべてのクリップボードが期限切れか削除済みです。",
  "list.summaryEmpty": "クラウドクリップボードはまだありません。",
  "list.badge.limitReached": "上限到達",
  "list.badge.expired": "期限切れ",
  "list.badge.remaining": (params) => {
    const { duration } = toDuration(params);
    return `残り ${duration}`;
  },
  "list.clipMeta": (params) => {
    const { created, type } = toClipMeta(params);
    return `${created} · ${type}`;
  },
  "list.clipType.text": "テキスト",
  "list.clipType.file": "ファイル",
  "list.fileMeta.downloads": (params) => {
    const { count, max } = toCountMax(params);
    return `ダウンロード: ${count} / ${max}`;
  },
  "list.fileUnavailable": "ファイルデータが利用できません。再アップロードしてください。",
  "list.remainingDownloads": (params) => {
    const { count } = toCount(params);
    return `残りダウンロード回数: ${count}`;
  },
  "list.codeLabel": (params) => {
    const { code } = toCode(params);
    return `ショートコード: ${code}`;
  },
  "list.tokenLabel": (params) => {
    const { token } = toToken(params);
    return `トークン: ${token}`;
  },

  "modal.title": "環境設定",
  "modal.description":
    "永続トークンを設定しておくと、クリップボード作成時に再利用できます。",
  "modal.tokenLabel": "永続トークン",
  "modal.tokenPlaceholder": "7 文字以上。英数字の組み合わせを推奨。",
  "modal.tokenHint":
    "このトークンは 720 時間使用されなかった場合、自動的に削除されます。",

  "tooltip.importClipboard": "システムのクリップボードを読み込む",
  "tooltip.switchToText": "クリップボード読み込みにはテキストモードに切り替えてください",

  "copy.target.directLink": "ダイレクトリンク",
  "copy.target.token": "トークン",
  "copy.target.text": "テキスト",
  "copy.target.file": "ファイル"
};

export const translations: Record<Locale, TranslationDictionary> = {
  "zh-CN": zhCN,
  en,
  ja
};

export const availableLocales: { value: Locale; labelKey: string }[] = [
  { value: "zh-CN", labelKey: "language.zhCN" },
  { value: "en", labelKey: "language.en" },
  { value: "ja", labelKey: "language.ja" }
];
