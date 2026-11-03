const AVATAR_COLORS = [
  '#1890ff',
  '#52c41a',
  '#faad14',
  '#f5222d',
  '#722ed1',
  '#13c2c2',
  '#eb2f96',
  '#fa8c16',
] as const;

/** Keep existing colors stable, including names containing surrogate pairs. */
export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index++) {
    // String.charAt selects one UTF-16 unit; iterating whole code points would change colors.
    const codeUnit = name.charAt(index).codePointAt(0);
    if (codeUnit === undefined) throw new Error('Invalid avatar name index');
    hash = codeUnit + ((hash << 5) - hash);
  }
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  if (color === undefined) throw new Error('Invalid avatar palette index');
  return color;
}
