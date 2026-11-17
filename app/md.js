// A tiny markdown renderer for bounty descriptions. It handles the shapes
// the API actually sends: ## / ### headings, bullet and numbered lists,
// **bold**, *italic*, `code`, fenced code blocks and [text](url) links.
// Everything else is a paragraph. All text is escaped first, so a description
// can never inject markup.

import { esc } from './format.js';

function inline(text) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" rel="noopener" target="_blank">$1</a>',
  );
  return out;
}

export function renderMd(source) {
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let list = null;
  let fence = false;
  let fenceBody = [];

  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (fence) {
        html.push(`<pre><code>${esc(fenceBody.join('\n'))}</code></pre>`);
        fenceBody = [];
        fence = false;
      } else {
        closeList();
        fence = true;
      }
      continue;
    }
    if (fence) {
      fenceBody.push(line);
      continue;
    }
    const heading = line.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      closeList();
      html.push(heading[1] === '##' ? `<h2>${inline(heading[2])}</h2>` : `<h3>${inline(heading[2])}</h3>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        closeList();
        list = kind;
        html.push(`<${kind}>`);
      }
      html.push(`<li>${inline((bullet || numbered)[1])}</li>`);
      continue;
    }
    if (line.trim() === '') {
      closeList();
      continue;
    }
    closeList();
    html.push(`<p>${inline(line.trim())}</p>`);
  }
  closeList();
  if (fence) html.push(`<pre><code>${esc(fenceBody.join('\n'))}</code></pre>`);
  return html.join('\n');
}
