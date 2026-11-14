// WPA2/WPA3 Personal passphrases require at least 8 characters.
// 64 hexadecimal digits are also accepted as a raw WPA2-PSK.
export function isValidProtectedWifiPassword(password: string): boolean {
  const bytes = Buffer.byteLength(password, "utf8");
  return (bytes >= 8 && bytes <= 63) || /^[0-9a-fA-F]{64}$/.test(password);
}
