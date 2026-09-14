// kb-site 构建管线：knowledge-vault → Astro 数据包
// 步骤契约见 skill: vault-web（E:/ai/ku/.agents/skills/vault-web/SKILL.md）
// vault 是唯一数据源；本脚本只读 vault，产物全部写入 src/（生成物，禁手改）

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import GithubSlugger from "github-slugger";

const VAULT = "E:/ai/ku/knowledge-vault";
const SITE = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const CONTENT_OUT = path.join(SITE, "src/content/vault");
const DATA_OUT = path.join(SITE, "src/data");

// 上站范围（维护者确认过期内容后在此增删；绝不删除 vault 原文件）
const INCLUDE_DIRS = [
  "00-Inbox", "01-知识笔记", "02-科普脚本", "03-公众号输出", "04-生活常识",
  "05-工具与技能", "06-对话沉淀", "07-学习路径", "90-MoC", "99-Dashboard",
  "网站", "考研", "项目解析",
];
const EXCLUDE_SEGMENTS = ["node_modules", ".git", ".obsidian", ".trash"];

const warnings = [];
const warn = (kind, file, detail) => warnings.push({ kind, file, detail });

const Frontmatter = z
  .object({
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    created: z.union([z.string(), z.date()]).optional(),
    aliases: z.array(z.union([z.string(), z.record(z.unknown())])).optional(),
    related: z.array(z.string()).optional(),
    status: z.string().optional(),
  })
  .passthrough();

function listMarkdown(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_SEGMENTS.includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdown(p));
    else if (entry.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function normalizeTags(fm) {
  if (!fm.tags) return [];
  if (Array.isArray(fm.tags)) return fm.tags.map(String);
  return String(fm.tags).split(/[,，\s]+/).filter(Boolean);
}

// ---- dataview 构建时重放 ----
// 支持：LIST + FROM #a [OR #b ...] [+ WHERE !contains(tags, "x") (AND ...)] [+ SORT created ASC|DESC]
// LIST 与 FROM 同行的单行形态（LIST FROM #tag）规范化为分行后同路处理；
// 其余形态（TABLE、TASK、无 FROM 的 LIST 等）返回 null → 计入警告（不阻断构建，见尾部说明）
function replayDataview(blockRaw, notesByTag) {
  const block = blockRaw.replace(/^(\s*)LIST\s+(FROM\s+.+)$/mi, "$1LIST\n$2");
  if (!/^\s*LIST\s*$/m.test(block)) return null;
  const fromM = block.match(/^FROM\s+(.+)$/m);
  if (!fromM) return null;
  const tags = fromM[1]
    .split(/\s+OR\s+/i)
    .map((s) => s.trim().match(/^#(.+)$/)?.[1] ?? null);
  if (!tags.length || tags.some((t) => t === null)) return null;

  const excludes = [];
  const whereM = block.match(/^WHERE\s+(.+)$/m);
  if (whereM) {
    for (const clause of whereM[1].split(/\s+AND\s+/i)) {
      const m = clause.trim().match(/^!contains\(tags,\s*"([^"]+)"\)$/);
      if (!m) return null;
      excludes.push(m[1]);
    }
  }
  const sortDesc = /SORT\s+created\s+DESC/i.test(block);

  const seen = new Set();
  const hits = [];
  for (const t of tags) {
    for (const n of notesByTag.get(t) ?? []) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      if (excludes.some((x) => n.tags.includes(x))) continue;
      hits.push(n);
    }
  }
  hits.sort((a, b) => (a.created ?? "").localeCompare(b.created ?? "") * (sortDesc ? -1 : 1));
  // 逐段编码：id 含 /，整体 encodeURIComponent 会产生 %2F（astro preview 500）
  return hits.map((n) => `- [${n.title}](/notes/${n.id.split("/").map(encodeURIComponent).join("/")}/)`).join("\n");
}

const files = INCLUDE_DIRS.flatMap((d) => {
  const abs = path.join(VAULT, d);
  return fs.existsSync(abs) ? listMarkdown(abs) : [];
});

const notes = [];

for (const abs of files) {
  const rel = path.relative(VAULT, abs).replaceAll("\\", "/");
  let raw = fs.readFileSync(abs, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // 剥 BOM，不回写 vault

  const parsed = (() => {
    try {
      return matter(raw);
    } catch {
      // frontmatter YAML 非法（如 Windows 路径反斜杠未转义）：降级为无 frontmatter，内容不丢
      warn("frontmatter-parse-error", rel, "YAML 解析失败，按无 frontmatter 处理");
      return { data: {}, content: raw };
    }
  })();
  const fm = Frontmatter.safeParse(parsed.data);
  if (!fm.success) {
    warn("frontmatter-invalid", rel, fm.error.issues.map((i) => i.message).join("; "));
    continue;
  }
  const data = fm.data;
  if (!data.tags) warn("missing-tags", rel, "");
  if (!data.created) warn("missing-created", rel, "");

  const segs = rel.split("/");
  const domain = segs[0] === "01-知识笔记" ? (segs[1] ?? segs[0]) : segs[0];
  const id = rel.replace(/\.md$/, "");
  const title = segs.at(-1).replace(/\.md$/, "");
  const created = data.created ? new Date(data.created).toISOString().slice(0, 10) : undefined;

  // dataview 块此遍仅占位标记，第二遍（全库索引齐后）统一重放
  let body = parsed.content;

  notes.push({
    id, title, domain, rel,
    tags: normalizeTags(data),
    aliases: (data.aliases ?? []).filter((a) => typeof a === "string"),
    status: data.status,
    created,
    collection: rel.startsWith("网站/批注/") ? "annotations" : "notes",
    body,
  });
}

// 二遍 dataview 重放（此刻全库标签索引已齐）
const notesByTag = new Map();
for (const n of notes) for (const t of n.tags) notesByTag.set(t, [...(notesByTag.get(t) ?? []), n]);
for (const n of notes) {
  n.body = n.body.replace(/```dataview\n([\s\S]*?)```/g, (m, block) => {
    const list = replayDataview(block, notesByTag);
    if (list === null) {
      // 体检 QUAL-001 修复：不支持形态必须计入警告，不得静默
      warn("unsupported-dataview", n.rel, block.split("\n")[0]);
      return `<!-- unsupported-dataview -->\n`;
    }
    return `<!-- dataview:replayed -->\n${list}\n`;
  });
}

// ---- TOC 锚点（体检 USAB-004 修复）：Astro 渲染 markdown 标题用 github-slugger 生成 id，
// 管线必须用同一实现才能对齐（自写正则在 emoji/箭头等符号上会失配）。每篇一个新实例，
// 与 rehype-slug 的每文档状态一致（重复标题自动 -1 后缀）。
// ---- 双链图谱 ----
const byTitle = new Map();
const byAlias = new Map();
for (const n of notes) {
  byTitle.set(n.title, n);
  for (const a of n.aliases) if (!byAlias.has(a)) byAlias.set(a, n);
}
const resolveLink = (target) => {
  // 支持 [[标题]] / [[别名]] / [[目录/标题]] / 任意形式 + #节 + |显示名
  const withoutSection = target.split("#")[0].trim().replace(/\.md$/, "");
  const candidates = [withoutSection, withoutSection.split("/").at(-1)];
  for (const c of candidates) {
    if (!c) continue;
    const hit = byTitle.get(c) ?? byAlias.get(c);
    if (hit) return hit;
  }
  return null;
};
// 逐段编码：/ 是路径分隔符不能进百分号编码（%2F 会被 astro preview/dev 拒绝）
const noteHref = (n) => `/notes/${n.id.split("/").map(encodeURIComponent).join("/")}/`;

// wikilink → 标准 markdown（先处理 ![[嵌入]] 再处理 [[链接]]，否则会被吃掉）
const linkWikiLinks = (body, selfId) =>
  body
    // ![[图片]] → 相对 vault 的 public 资产路径（管线拷贝 assets/ 到 public/vault-assets/）
    .replace(/!\[\[([^\]]+\.(?:png|jpe?g|gif|webp|svg))\]\]/gi, (m, p) => {
      const assetRel = p.trim().replace(/^(assets\/)?/i, "");
      return `![${assetRel}](/vault-assets/${encodeURI(assetRel)})`;
    })
    // ![[笔记名]] → 嵌入式链接卡片（v1 降级为引用链接）
    .replace(/!\[\[([^\]]+)\]\]/g, (m, t) => {
      const hit = resolveLink(t);
      const label = t.split("|").at(-1).split("#")[0].trim();
      return hit ? `📎 [${label}](${noteHref(hit)})` : `📎 <span class="wikilink-broken">${label}</span>`;
    })
    // [[target|display]] / [[target#sec]] / [[target]]
    .replace(/\[\[([^\]]+)\]\]/g, (m, t) => {
      const display = (t.includes("|") ? t.split("|")[1] : t.split("#")[0]).trim().split("/").at(-1);
      const hit = resolveLink(t);
      if (!hit) return `<span class="wikilink-broken">${display}</span>`;
      const anchor = t.includes("#") ? `#${encodeURIComponent(t.split("#")[1].trim())}` : "";
      if (hit.id === selfId) return `<strong>${display}</strong>`;
      return `[${display}](${noteHref(hit)}${anchor})`;
    });

const embedAssets = true;

// ---- 双链预览数据（popover 用）：标题 + 首个非标题非空段落 ----
const previews = {};
for (const n of notes) {
  const para = n.body
    .split(/\n+/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#") && !l.startsWith(">") && !l.startsWith("```") && !l.startsWith("|"));
  previews[n.id] = {
    title: n.title, domain: n.domain, created: n.created,
    excerpt: (para ?? "").replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2").slice(0, 160),
  };
}

const nodes = notes.map((n) => ({
  id: n.id, title: n.title, domain: n.domain, tags: n.tags,
  created: n.created, maturity: null,
}));
const edges = [];
const broken = [];
for (const n of notes) {
  for (const m of n.body.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const t = m[1];
    const target = resolveLink(t);
    if (target) edges.push({ source: n.id, target: target.id });
    else broken.push({ from: n.id, link: t });
  }
}
for (const b of broken) warn("broken-link", b.from, b.link);

// ---- 反向链接 ----
const backlinks = {};
for (const e of edges) (backlinks[e.target] ??= []).push(e.source);

// ---- 问题日志 ----
const qlogPath = path.join(VAULT, "07-学习路径/00-问题日志/问题日志.md");
const questions = [];
if (fs.existsSync(qlogPath)) {
  let raw = fs.readFileSync(qlogPath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  const sections = raw.split(/^## /m).slice(1);
  for (const s of sections) {
    const head = s.match(/^(Q\d+)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*(.+)/);
    if (!head) continue;
    const status = s.match(/^- 状态：(.+)$/m)?.[1]?.trim();
    const note = s.match(/^- 知识点：\[\[(.+?)\]\]/m)?.[1]?.trim();
    const adjacent = [...s.matchAll(/Q\d+/g)].map((m) => m[0]).filter((q) => q !== head[1]);
    questions.push({
      id: head[1], date: head[2], question: head[3].trim(),
      status: status ?? "open", note, adjacent,
    });
  }
} else {
  warn("missing-file", "07-学习路径/00-问题日志/问题日志.md", "");
}

// ---- progress.json 透传 ----
const progressPath = path.join(VAULT, "07-学习路径/00-学习状态/progress.json");
const progress = fs.existsSync(progressPath) ? JSON.parse(fs.readFileSync(progressPath, "utf8")) : null;

// ---- 写产物 ----
fs.rmSync(CONTENT_OUT, { recursive: true, force: true });
fs.rmSync(DATA_OUT, { recursive: true, force: true });
fs.mkdirSync(CONTENT_OUT, { recursive: true });
fs.mkdirSync(DATA_OUT, { recursive: true });

for (const n of notes) {
  const out = path.join(CONTENT_OUT, `${n.id}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const front = {
    title: n.title, domain: n.domain, originalPath: n.rel,
    tags: n.tags, aliases: n.aliases, created: n.created,
    status: n.status, collection: n.collection,
    // toc 条目带 slug 化锚点 id（github-slugger，与 Astro 渲染的 h2 id 同实现），t 保留原文用于显示。
    // 提取须跳过 ``` 围栏内的伪标题（如模板示例中的 ## 行）——Astro 渲染时它们不是标题（体检 TOC 失配残留根因）
    toc: (() => {
      const slugger = new GithubSlugger();
      const out = [];
      let inFence = false;
      for (const line of n.body.split("\n")) {
        if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
        if (inFence) continue;
        const m = line.match(/^## (.+)$/);
        if (m) { const t = m[1].trim(); out.push({ t, id: slugger.slug(t) }); }
      }
      return out;
    })(),
  };
  for (const k of Object.keys(front)) if (front[k] === undefined || k === "toc" && !front.toc.length) delete front[k];
  fs.writeFileSync(out, matter.stringify(linkWikiLinks(n.body, n.id), front), "utf8");
}

// vault 图片资产 → public（!![[x.png]] 嵌入引用 /vault-assets/）
const vaultAssets = path.join(VAULT, "assets");
if (fs.existsSync(vaultAssets)) {
  fs.rmSync(path.join(SITE, "public/vault-assets"), { recursive: true, force: true });
  fs.cpSync(vaultAssets, path.join(SITE, "public/vault-assets"), { recursive: true });
}

fs.writeFileSync(path.join(DATA_OUT, "graph.json"), JSON.stringify({ nodes, edges }));
fs.writeFileSync(path.join(DATA_OUT, "backlinks.json"), JSON.stringify(backlinks));
fs.writeFileSync(path.join(DATA_OUT, "previews.json"), JSON.stringify(previews));
fs.writeFileSync(path.join(DATA_OUT, "questions.json"), JSON.stringify(questions));
if (progress) fs.writeFileSync(path.join(DATA_OUT, "progress.json"), JSON.stringify(progress));
fs.writeFileSync(
  path.join(DATA_OUT, "stats.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    notes: notes.length,
    domains: [...new Set(notes.map((n) => n.domain))].length,
    edges: edges.length,
    brokenLinks: broken.length,
    questions: questions.length,
    questionsOpen: questions.filter((q) => q.status === "open").length,
    unsupportedDataviews: warnings.filter((w) => w.kind === "unsupported-dataview").length,
  })
);
fs.writeFileSync(path.join(SITE, "pipeline/warnings.json"), JSON.stringify(warnings, null, 2));

// ---- 摘要 ----
console.log(`✅ 管线完成：${notes.length} 篇笔记 / ${nodes.length} 节点 / ${edges.length} 边 / ${questions.length} 问题（${questions.filter((q) => q.status === "open").length} open）`);
const byKind = {};
for (const w of warnings) byKind[w.kind] = (byKind[w.kind] ?? 0) + 1;
if (Object.keys(byKind).length) {
  console.log(`⚠️  警告 ${warnings.length} 条：`, byKind);
  console.log("   详见 pipeline/warnings.json");
}
const unsupported = warnings.filter((w) => w.kind === "unsupported-dataview");
if (unsupported.length) {
  // 已知降级（TABLE/TASK 等 v1 不渲染，页面留占位注释）：警告可见但不阻断构建，
  // 否则这批一直存在的降级项会让每次 build 都失败
  console.log(`⚠️  ${unsupported.length} 个 dataview 查询无法重放（已降级为占位，详见 warnings.json）`);
}
