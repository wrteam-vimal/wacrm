import React from 'react';

type FormattedNode = React.ReactNode;

interface Block {
  type: 'paragraph' | 'blockquote' | 'bullet_list' | 'numbered_list';
  lines: string[];
}

/**
 * Parses inline formatting characters for WhatsApp:
 * - *text* for bold
 * - _text_ for italic
 * - ~text~ for strikethrough
 * - ```text``` for monospace
 * Returns an array of React nodes.
 */
export function parseWhatsAppInline(text: string): FormattedNode[] {
  if (!text) return [];

  // Patterns matching WhatsApp styling guidelines:
  // Monospace: ```text```
  const monoRegex = /^([\s\S]*?)```([^`\n]+)```([\s\S]*)$/;
  // Bold: *text* (starts and ends with non-space)
  const boldRegex = /^([\s\S]*?)\*([^\s*](?:[^*]*?[^\s*])?)\*([\s\S]*)$/;
  // Italic: _text_ (starts and ends with non-space)
  const italicRegex = /^([\s\S]*?)_([^\s_](?:[^_]*?[^\s_])?)_([\s\S]*)$/;
  // Strikethrough: ~text~ (starts and ends with non-space)
  const strikeRegex = /^([\s\S]*?)~([^\s~](?:[^~]*?[^\s~])?)~([\s\S]*)$/;

  let bestMatch: any = null;

  const checkMatch = (regex: RegExp, type: 'mono' | 'bold' | 'italic' | 'strike') => {
    const match = text.match(regex);
    if (match) {
      const prefix = match[1];
      if (bestMatch === null || prefix.length < bestMatch.prefix.length) {
        bestMatch = {
          type,
          prefix,
          inner: match[2],
          suffix: match[3],
        };
      }
    }
  };

  checkMatch(monoRegex, 'mono');
  checkMatch(boldRegex, 'bold');
  checkMatch(italicRegex, 'italic');
  checkMatch(strikeRegex, 'strike');

  const resolvedMatch = bestMatch as {
    type: 'mono' | 'bold' | 'italic' | 'strike';
    prefix: string;
    inner: string;
    suffix: string;
  } | null;

  if (resolvedMatch) {
    const { type, prefix, inner, suffix } = resolvedMatch;
    const nodes: FormattedNode[] = [];
    
    if (prefix) {
      nodes.push(...parseWhatsAppInline(prefix));
    }

    const key = `${type}-${inner}-${prefix.length}`;
    if (type === 'mono') {
      nodes.push(
        <code key={key} className="font-mono bg-slate-950/60 px-1 py-0.5 rounded text-pink-400 border border-slate-800 text-xs">
          {inner}
        </code>
      );
    } else if (type === 'bold') {
      nodes.push(
        <strong key={key} className="font-bold text-white">
          {parseWhatsAppInline(inner)}
        </strong>
      );
    } else if (type === 'italic') {
      nodes.push(
        <em key={key} className="italic text-slate-200">
          {parseWhatsAppInline(inner)}
        </em>
      );
    } else if (type === 'strike') {
      nodes.push(
        <del key={key} className="line-through text-slate-400">
          {parseWhatsAppInline(inner)}
        </del>
      );
    }

    if (suffix) {
      nodes.push(...parseWhatsAppInline(suffix));
    }

    return nodes;
  }

  return [text];
}

/**
 * Parses block level styles (paragraphs, quotes, lists) and returns styled React nodes.
 */
export function formatWhatsAppText(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split('\n');
  const blocks: Block[] = [];
  let currentBlock: Block | null = null;

  for (const line of lines) {
    // Blockquote: line starts with '>' optional space
    const quoteMatch = line.match(/^>\s?(.*)$/);
    // Bullet list: line starts with '-' or '*' and space
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    // Numbered list: line starts with numbers, '.' and space
    const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);

    if (quoteMatch) {
      const content = quoteMatch[1];
      if (currentBlock && currentBlock.type === 'blockquote') {
        currentBlock.lines.push(content);
      } else {
        currentBlock = { type: 'blockquote', lines: [content] };
        blocks.push(currentBlock);
      }
    } else if (bulletMatch) {
      const content = bulletMatch[1];
      if (currentBlock && currentBlock.type === 'bullet_list') {
        currentBlock.lines.push(content);
      } else {
        currentBlock = { type: 'bullet_list', lines: [content] };
        blocks.push(currentBlock);
      }
    } else if (numberedMatch) {
      const content = numberedMatch[2];
      if (currentBlock && currentBlock.type === 'numbered_list') {
        currentBlock.lines.push(content);
      } else {
        currentBlock = { type: 'numbered_list', lines: [content] };
        blocks.push(currentBlock);
      }
    } else {
      if (currentBlock && currentBlock.type === 'paragraph') {
        currentBlock.lines.push(line);
      } else {
        currentBlock = { type: 'paragraph', lines: [line] };
        blocks.push(currentBlock);
      }
    }
  }

  return (
    <div className="space-y-1.5 text-left">
      {blocks.map((block, bIdx) => {
        const key = `block-${block.type}-${bIdx}`;
        switch (block.type) {
          case 'blockquote':
            return (
              <blockquote key={key} className="border-l-4 border-slate-600 bg-slate-950/20 pl-3 py-1 my-1 italic text-slate-300/90 rounded-r">
                {block.lines.map((line, lIdx) => (
                  <div key={lIdx}>
                    {parseWhatsAppInline(line)}
                  </div>
                ))}
              </blockquote>
            );
          case 'bullet_list':
            return (
              <ul key={key} className="list-disc pl-5 space-y-0.5 my-1">
                {block.lines.map((line, lIdx) => (
                  <li key={lIdx} className="text-slate-200">
                    {parseWhatsAppInline(line)}
                  </li>
                ))}
              </ul>
            );
          case 'numbered_list':
            return (
              <ol key={key} className="list-decimal pl-5 space-y-0.5 my-1">
                {block.lines.map((line, lIdx) => (
                  <li key={lIdx} className="text-slate-200">
                    {parseWhatsAppInline(line)}
                  </li>
                ))}
              </ol>
            );
          case 'paragraph':
          default:
            return (
              <p key={key} className="whitespace-pre-wrap break-words leading-relaxed text-slate-250">
                {block.lines.map((line, lIdx) => (
                  <React.Fragment key={lIdx}>
                    {lIdx > 0 && '\n'}
                    {parseWhatsAppInline(line)}
                  </React.Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
