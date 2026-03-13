/**
 * Common typos for DI agent guardrail. When the user message contains one of these
 * (as a word), we inject an instruction so the agent asks for confirmation.
 * Key: typo (lowercase), Value: suggested correct word.
 */
export const COMMON_TYPOS: Record<string, string> = {
  protopese: 'propose',
  protopsete: 'propose',
  propse: 'propose',
  propos: 'propose',
  decsion: 'decision',
  decison: 'decision',
  stratagy: 'strategy',
  stratgey: 'strategy',
  decsions: 'decisions',
  propodal: 'proposal',
  proporsal: 'proposal',
};

/**
 * Returns { typo, correct } if the message contains a known typo (whole-word match), else null.
 */
export function detectTypo(message: string): { typo: string; correct: string } | null {
  if (!message || typeof message !== 'string') return null;
  const lower = message.toLowerCase();
  const words = lower.split(/\s+/);
  for (const word of words) {
    const cleaned = word.replace(/[^\w]/g, '');
    if (COMMON_TYPOS[cleaned]) {
      return { typo: cleaned, correct: COMMON_TYPOS[cleaned] };
    }
  }
  return null;
}
