export function extractPlaceholders(content: string): string[] {
  const matches = content.matchAll(/【([^】]+)】/g);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of matches) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}

export function renderTemplate(content: string, formData: Record<string, string>): string {
  return content.replace(/【([^】]+)】/g, (_match, name) => formData[name] ?? '');
}

export function validateTemplate(content: string): { valid: boolean; unmatched: string[] } {
  const unmatched: string[] = [];
  // Find 【 without matching 】
  let i = 0;
  while (i < content.length) {
    const openIdx = content.indexOf('【', i);
    if (openIdx === -1) break;
    const closeIdx = content.indexOf('】', openIdx);
    if (closeIdx === -1) {
      unmatched.push(content.slice(openIdx, Math.min(openIdx + 20, content.length)));
      break;
    }
    i = closeIdx + 1;
  }
  return { valid: unmatched.length === 0, unmatched };
}
