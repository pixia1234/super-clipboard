export const canUseClipboardApi = (): boolean =>
  typeof navigator !== "undefined" &&
  Boolean(navigator.clipboard) &&
  typeof navigator.clipboard.readText === "function";

export const readFromClipboard = async (): Promise<string | null> => {
  if (!canUseClipboardApi()) {
    return null;
  }

  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    console.warn("无法读取系统剪贴板：", error);
    return null;
  }
};

export const writeToClipboard = async (value: string): Promise<boolean> => {
  if (!value) {
    return false;
  }

  if (canUseClipboardApi()) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      console.warn("写入系统剪贴板失败：", error);
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch (error) {
    console.warn("备用复制方式失败：", error);
    return false;
  }
};
