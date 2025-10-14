const digits = "0123456789";
const tokenAlphabet =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export const generateAccessCode = (length = 5): string => {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * digits.length);
    result += digits[randomIndex];
  }
  return result;
};

export const generateToken = (length = 12): string => {
  let result = "";
  const alphabetLength = tokenAlphabet.length;
  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabetLength);
    result += tokenAlphabet[randomIndex];
  }
  return result;
};

export const hoursToMilliseconds = (hours: number): number =>
  Math.round(hours * 60 * 60 * 1000);

export const formatBytes = (size: number): string => {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const base = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(size) / Math.log(base)),
    units.length - 1
  );
  const value = size / Math.pow(base, exponent);

  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};
