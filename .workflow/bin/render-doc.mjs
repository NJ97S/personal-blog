#!/usr/bin/env node
//
// render-doc.mjs — render workflow Markdown docs to standalone HTML.
//
// HTML is a derived view: Markdown is the single source of truth. Reuses the
// project's already-installed remark/rehype stack (no new dependency, offline).
//
// Usage:
//   node .workflow/bin/render-doc.mjs <file.md>     # render one file -> sibling .html
//   node .workflow/bin/render-doc.mjs <dir>         # render every .md under <dir>
//
// Mermaid code blocks are rendered client-side (mermaid loaded from a CDN when the
// HTML is opened in a browser online; offline, the diagram source shows as text).
//
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkBreaks)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSlug)
  .use(rehypeHighlight, { plainText: ['mermaid'], detect: true })
  .use(rehypeStringify, { allowDangerousHtml: true });

function titleFrom(md, fallback) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function page(title, body) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/</g, '&lt;')}</title>
<style>
  /* Light mode only — craft-paper theme, tuned for legibility. */
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { max-width: 760px; margin: 0 auto; padding: 3rem 1.5rem 6rem;
    font: 16.5px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
    color: #2f2820; background: #fdf8f0;
    -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
  article > :first-child { margin-top: 0; }
  h1, h2, h3, h4 { line-height: 1.3; margin: 2em 0 .6em; font-weight: 700; color: #1a1410; letter-spacing: -.01em; }
  h1 { font-size: 2rem; margin-top: 0; border-bottom: 2px solid #e8d5b0; padding-bottom: .35em; }
  h2 { font-size: 1.45rem; border-bottom: 1px solid #ece0c8; padding-bottom: .3em; }
  h3 { font-size: 1.18rem; color: #4a3f35; }
  h4 { font-size: 1.02rem; color: #4a3f35; }
  p, li { color: #383027; }
  ul, ol { padding-left: 1.4em; }
  li { margin: .3em 0; }
  li::marker { color: #a9946f; }
  a { color: #146c43; text-decoration: none; border-bottom: 1px solid rgba(20,108,67,.35); }
  a:hover { border-bottom-color: #146c43; }
  strong { color: #1a1410; font-weight: 700; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85em;
    background: #f0e6d2; color: #8a3b1d; padding: .15em .42em; border-radius: 5px; }
  pre { background: #f5efe2; border: 1px solid #e6dcc4; border-radius: 10px; padding: 1.1rem 1.2rem;
    overflow-x: auto; line-height: 1.55; }
  pre code { background: none; padding: 0; color: #2f2820; font-size: .86em; }
  blockquote { margin: 1.2em 0; padding: .6em 1.1em; border-left: 4px solid #c39d5c;
    color: #4a3f35; background: #f7f0e2; border-radius: 0 8px 8px 0; }
  blockquote > :first-child { margin-top: 0; }
  blockquote > :last-child { margin-bottom: 0; }
  table { border-collapse: collapse; width: 100%; margin: 1.2em 0; display: block; overflow-x: auto; font-size: .95em; }
  th, td { border: 1px solid #e2d7bf; padding: .55em .85em; text-align: left; vertical-align: top; }
  th { background: #f0e6d2; color: #1a1410; font-weight: 700; }
  tr:nth-child(even) td { background: #faf4e8; }
  hr { border: none; border-top: 1px solid #e6dcc4; margin: 2.4em 0; }
  .mermaid { background: #f7f0e2; border: 1px solid #e8d5b0; border-radius: 10px; padding: 1rem; text-align: center; }
  .hljs-keyword,.hljs-selector-tag,.hljs-built_in { color: #cf222e; }
  .hljs-string,.hljs-attr { color: #0a3069; }
  .hljs-comment { color: #6e7781; font-style: italic; }
  .hljs-number,.hljs-literal { color: #0550ae; }
  .hljs-title,.hljs-section { color: #8250df; }
</style>
</head>
<body>
<article>
${body}
</article>
<script type="module">
  // Turn mermaid fenced code blocks into rendered diagrams (client-side, needs network).
  const blocks = document.querySelectorAll('pre > code.language-mermaid, pre > code.mermaid');
  if (blocks.length) {
    try {
      const { default: mermaid } = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
      blocks.forEach(code => {
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = code.textContent;
        code.closest('pre').replaceWith(div);
      });
      mermaid.initialize({ startOnLoad: false, theme: 'default' });
      await mermaid.run();
    } catch (e) { /* offline: leave the mermaid source as a code block */ }
  }
</script>
</body>
</html>
`;
}

async function renderFile(mdPath) {
  const md = readFileSync(mdPath, 'utf8');
  const bodyHtml = String(await processor.process(md));
  const title = titleFrom(md, basename(mdPath, '.md'));
  const outPath = join(dirname(mdPath), basename(mdPath, '.md') + '.html');
  writeFileSync(outPath, page(title, bodyHtml));
  return outPath;
}

function collectMd(target) {
  const st = statSync(target);
  if (st.isFile()) return target.endsWith('.md') ? [target] : [];
  return readdirSync(target).flatMap(name => collectMd(join(target, name)));
}

const target = process.argv[2];
if (!target) {
  console.error('usage: render-doc.mjs <file.md | dir>');
  process.exit(2);
}
const files = collectMd(target);
if (!files.length) { console.error(`render-doc: no .md under ${target}`); process.exit(1); }
for (const f of files) {
  const out = await renderFile(f);
  console.error(`render-doc: ${f} -> ${out}`);
}
