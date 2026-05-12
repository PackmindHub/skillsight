const HUES = [262, 187, 35, 320, 152, 18, 215, 290, 95];

function skillHue(skill: string): number {
  let h = 0;
  for (let i = 0; i < skill.length; i++) {
    h = (h * 31 + skill.charCodeAt(i)) >>> 0;
  }
  return HUES[h % HUES.length] ?? HUES[0]!;
}

export function skillColor(skill: string, alpha = 1): string {
  return `oklch(0.72 0.16 ${skillHue(skill)} / ${alpha})`;
}
