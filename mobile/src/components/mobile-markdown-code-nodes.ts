import type { Code } from 'mdast'
import type MarkdownIt from 'markdown-it'

export type Token = ReturnType<MarkdownIt['parse']>[number]

/** Whether a code block's closing fence has arrived; an unclosed one is still streaming in. */
export function codeFenceClosed(node: Code): boolean {
  return !('closed' in node) || node.closed !== false
}

export function codeNode(token: Token, lines: readonly string[]): Code & { closed: boolean } {
  if (token.type !== 'fence') {
    return { type: 'code', lang: null, value: token.content.replace(/\n$/, ''), closed: true }
  }
  const [start, end] = token.map ?? [0, 0]
  // A fence inside a quote carries the quote's marker on its closing line.
  const closing = end - start > 1 ? (lines[end - 1] ?? '').replace(/^[\s>]*/, '').trim() : ''
  return {
    type: 'code',
    lang: token.info.trim().split(/\s+/)[0] || null,
    value: token.content.replace(/\n$/, ''),
    closed:
      closing.length >= token.markup.length &&
      [...closing].every((char) => char === token.markup[0])
  }
}
