#!/usr/bin/env node
/**
 * Generates resume.html from index.html.
 *
 * index.html is the single source of truth: the project data, about.md,
 * skills.md and contact.md all live in it. Nothing here is authored by hand,
 * so the resume cannot drift from the site the way the old plain.html did.
 */
const fs = require("fs");

const src = fs.readFileSync("index.html", "utf8");

/** Read the template literal that follows `marker`. */
function tpl(s, marker) {
  const i = s.indexOf(marker);
  if (i < 0) return null;
  const start = s.indexOf("`", i) + 1;
  let j = start;
  while (j < s.length && s[j] !== "`") j += s[j] === "\\" ? 2 : 1;
  return s.slice(start, j);
}

const ORDER = [...src.match(/const ORDER = \[(.*?)\];/s)[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);

function project(key) {
  const i = src.indexOf(`"${key}": {`);
  const seg = src.slice(i, i + 80000);
  const beforeMd = seg.slice(0, seg.indexOf("md:"));
  return {
    name: tpl(seg, "name:"),
    stack: tpl(seg, "stack:"),
    site: beforeMd.includes("site:") ? tpl(seg, "site:") : null,
    md: tpl(seg, "md:"),
  };
}

/** First real prose paragraph: skip the H1 and any image-only lines. */
function blurb(md) {
  const paras = md.split(/\n\s*\n/).map(p => p.trim());
  for (const p of paras) {
    if (!p || p.startsWith("#") || /^!\[/.test(p)) continue;
    return p.replace(/\s*\n\s*/g, " ");
  }
  return "";
}

/** Pull "## Section" -> [items] out of a markdown doc. */
function sections(md) {
  const out = [];
  let cur = null;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("## ")) { cur = { title: line.slice(3), items: [], prose: [] }; out.push(cur); }
    else if (!cur) continue;
    else if (line.startsWith("- ")) cur.items.push(line.slice(2));
    else if (line) cur.prose.push(line);
  }
  return out;
}

const esc = t => String(t).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const linkify = t => esc(t).replace(/(https?:\/\/[^\s<]+)/g,
  '<a href="$1">$1</a>');

const ABOUT = tpl(src, "const ABOUT ="),
      SKILLS = tpl(src, "const SKILLS ="),
      CONTACT = tpl(src, "const CONTACT =");

const contact = Object.fromEntries(
  sections(CONTACT).map(s => [s.title.toLowerCase(), s.prose.join(" ")]));

// The H1 already says the name; drop the "I'm <name>, and " opener so the
// summary doesn't repeat it two lines later.
const summary = blurb(ABOUT)
  .replace(/^I'm\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*and\s+/, m => "")
  .replace(/^([a-z])/, c => c.toUpperCase());

const projects = ORDER.map(project);
const aboutSections = sections(ABOUT);
const whereAt = aboutSections.find(s => /where/i.test(s.title));

const html = `<meta charset="utf-8">
<title>Dillon Webster — Resume</title>
<style>
  :root { --ink:#16191c; --dim:#5b666e; --rule:#d8dee2; --link:#15607a; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto; padding: 36px 28px 48px; max-width: 46rem;
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    color: var(--ink); background: #fff;
  }
  h1 { font-size: 27px; margin: 0 0 4px; letter-spacing: -.01em; }
  h2 {
    font-size: 12px; text-transform: uppercase; letter-spacing: .09em;
    color: var(--dim); margin: 20px 0 9px; padding-bottom: 5px;
    border-bottom: 1px solid var(--rule);
  }
  a { color: var(--link); }
  .meta { color: var(--dim); font-size: 14px; margin: 0 0 2px; }
  .meta a { color: var(--link); text-decoration: none; }
  .summary { margin: 14px 0 0; }
  .proj { margin: 0 0 12px; page-break-inside: avoid; break-inside: avoid; }
  .proj h3 { font-size: 15.5px; margin: 0 0 1px; }
  .proj .stack { font-size: 12.5px; color: var(--dim); margin: 0 0 4px; }
  .proj p { margin: 0; }
  .skills { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 26px; }
  .skills div { font-size: 14px; }
  .skills b { font-weight: 600; }
  @media print {
    body { padding: 0; max-width: none; font-size: 10.4pt; line-height: 1.4; }
    a { color: var(--ink); text-decoration: none; }
    h2 { margin: 15px 0 7px; }
    .proj { margin-bottom: 9px; }
    .summary { margin-top: 10px; }
  }
  @page { margin: 14mm; }
</style>

<h1>Dillon Webster</h1>
<p class="meta">${esc(contact.location || "")} &middot; <a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a> &middot; <a href="${esc(contact.github)}">${esc((contact.github || "").replace(/^https?:\/\//, ""))}</a></p>
${whereAt ? `<p class="meta">${esc(whereAt.prose.join(" "))}</p>` : ""}

<p class="summary">${esc(summary)}</p>

<h2>Projects</h2>
${projects.map(p => `<div class="proj">
  <h3>${esc(p.name)}${p.site ? ` &mdash; <a href="${esc(p.site)}">${esc(p.site.replace(/^https?:\/\//, ""))}</a>` : ""}</h3>
  <p class="stack">${esc(p.stack)}</p>
  <p>${esc(blurb(p.md))}</p>
</div>`).join("\n")}

<h2>Skills</h2>
<div class="skills">
${sections(SKILLS).map(s => `  <div><b>${esc(s.title)}:</b> ${esc(s.items.join(", "))}</div>`).join("\n")}
</div>
`;

fs.writeFileSync("resume.html", html);
console.log(`resume.html written — ${projects.length} projects, ${(html.length / 1024).toFixed(1)}KB`);
