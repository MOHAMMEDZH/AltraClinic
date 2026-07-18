import type { ReactNode } from 'react';
import { parseAiMarkdown } from '../../lib/ai-markdown-parse';
import e from '../../ai-enterprise.module.css';

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    }
    const token = match[0];
    if (token.startsWith('`')) {
      parts.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) {
    parts.push(<span key={key++}>{text.slice(last)}</span>);
  }

  return parts.length ? parts : [text];
}

export function AiMarkdown({ content }: { content: string }) {
  const blocks = parseAiMarkdown(content);

  return (
    <div className={e.mdContent}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h3':
            return (
              <h3 key={idx} className={e.mdTitle}>
                {renderInline(block.text)}
              </h3>
            );
          case 'section':
            return (
              <p key={idx} className={e.mdSectionTitle}>
                {renderInline(block.text)}
              </p>
            );
          case 'p':
            return (
              <p key={idx} className={e.mdParagraph}>
                {renderInline(block.text)}
              </p>
            );
          case 'ul':
            return (
              <ul key={idx} className={e.mdList}>
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className={e.mdList}>
                {block.items.map((item, i) => (
                  <li key={i}>{renderInline(item)}</li>
                ))}
              </ol>
            );
          case 'hr':
            return <hr key={idx} className={e.mdDivider} />;
          case 'pre':
            return (
              <pre key={idx} className={e.mdPre}>
                <code>{block.code}</code>
              </pre>
            );
          case 'footer':
            return (
              <p key={idx} className={e.mdFooter}>
                {renderInline(block.text)}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
