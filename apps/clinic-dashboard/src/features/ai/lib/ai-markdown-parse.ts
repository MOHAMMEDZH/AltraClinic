export type AiMarkdownBlock =
  | { type: 'h3'; text: string }
  | { type: 'section'; text: string }
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'hr' }
  | { type: 'pre'; code: string }
  | { type: 'footer'; text: string };

export function parseAiMarkdown(content: string): AiMarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: AiMarkdownBlock[] = [];
  let ul: string[] = [];
  let ol: string[] = [];
  let para: string[] = [];
  let inCode = false;
  let code: string[] = [];
  let afterHr = false;

  const flushUl = () => {
    if (ul.length) {
      blocks.push({ type: 'ul', items: ul });
      ul = [];
    }
  };
  const flushOl = () => {
    if (ol.length) {
      blocks.push({ type: 'ol', items: ol });
      ol = [];
    }
  };
  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: 'p', text: para.join(' ') });
      para = [];
    }
  };
  const flushAll = () => {
    flushUl();
    flushOl();
    flushPara();
  };

  for (const line of lines) {
    if (inCode) {
      if (line.trim().startsWith('```')) {
        blocks.push({ type: 'pre', code: code.join('\n') });
        code = [];
        inCode = false;
      } else {
        code.push(line);
      }
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushAll();
      continue;
    }

    if (trimmed === '---') {
      flushAll();
      blocks.push({ type: 'hr' });
      afterHr = true;
      continue;
    }

    if (trimmed.startsWith('```')) {
      flushAll();
      inCode = true;
      continue;
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      flushAll();
      blocks.push({ type: 'h3', text: trimmed.replace(/^#+\s+/, '') });
      afterHr = false;
      continue;
    }

    if (/^[-*]\s/.test(trimmed)) {
      flushOl();
      flushPara();
      ul.push(trimmed.replace(/^[-*]\s+/, ''));
      afterHr = false;
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      flushUl();
      flushPara();
      ol.push(trimmed.replace(/^\d+\.\s+/, ''));
      afterHr = false;
      continue;
    }

    if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
      flushAll();
      const text = trimmed.slice(2, -2);
      if (afterHr) {
        blocks.push({ type: 'footer', text });
      } else {
        blocks.push({ type: 'section', text });
      }
      afterHr = false;
      continue;
    }

    if (afterHr && (/^\*[^*]+\*$/.test(trimmed) || trimmed.startsWith('*'))) {
      flushAll();
      blocks.push({ type: 'footer', text: trimmed.replace(/^\*+|\*+$/g, '') });
      afterHr = false;
      continue;
    }

    flushUl();
    flushOl();
    para.push(trimmed);
    afterHr = false;
  }

  flushAll();
  if (inCode && code.length) {
    blocks.push({ type: 'pre', code: code.join('\n') });
  }

  return blocks;
}
