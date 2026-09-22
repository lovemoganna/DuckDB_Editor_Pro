export interface AIEgressResult {
  text: string;
  redactionCount: number;
}

function replaceAndCount(
  input: string,
  pattern: RegExp,
  replacement: string,
): AIEgressResult {
  const redactionCount = input.match(pattern)?.length ?? 0;
  return {
    text: input.replace(pattern, replacement),
    redactionCount,
  };
}

/**
 * Default-deny policy for raw row values. Schema names and aggregate metadata
 * remain available, while sample blocks and common direct identifiers are
 * removed before any provider SDK or fetch call receives the prompt.
 */
export function applyAIEgressPolicy(input: string): AIEgressResult {
  let text = input;
  let redactionCount = 0;

  const rules: Array<[RegExp, string]> = [
    [
      /((?:^|\n)#{1,6}[^\n]*(?:sample data|data sample|样本数据|数据样本)[^\n]*\n```[^\n]*\n)[\s\S]*?(\n```)/gi,
      '$1[ROW SAMPLES REDACTED]$2',
    ],
    [
      /((?:^|\n)\s*[-*]?\s*(?:sample data|data sample|样本数据|数据样本)\s*:\s*\n)[\s\S]*?(?=\n\s*(?:---|#{1,6}\s)|$)/gi,
      '$1[ROW SAMPLES REDACTED]\n',
    ],
    [/\[Top Distributions:[^\]]*\]/gi, '[Top Distributions: redacted]'],
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL REDACTED]'],
    [/\b(?:\d[ -]*?){13,19}\b/g, '[LONG NUMBER REDACTED]'],
    [/\+?\d[\d\s()-]{8,}\d/g, '[PHONE REDACTED]'],
    [/\b(?:sk|key|token)-[A-Za-z0-9_-]{12,}\b/gi, '[TOKEN REDACTED]'],
  ];

  for (const [pattern, replacement] of rules) {
    const result = replaceAndCount(text, pattern, replacement);
    text = result.text;
    redactionCount += result.redactionCount;
  }

  return { text, redactionCount };
}

export function summarizeAITraceText(text: string, kind: 'prompt' | 'response'): string {
  return `[${kind} omitted by AI egress policy; length=${text.length}]`;
}
