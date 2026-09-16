// 批注落盘服务（R8）：接收 kb-site 前端批注 → 写入 vault/网站/批注/
// 格式契约见 skill: kb-annotate。仅绑定 127.0.0.1，只写批注目录，文件名白名单化。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

// 项目已独立至 E:/ai/kb-site：路径可用环境变量覆盖，默认按相对位置解析
const VAULT_ANNOT = process.env.VAULT_DIR
  ? path.join(process.env.VAULT_DIR, "网站/批注")
  : "E:/ai/ku/knowledge-vault/网站/批注";
const VAULT_CONTENT = path.join(import.meta.dirname ?? ".", "..", "src/content/vault"); // 管线生成物：用于组装讲解上下文
const INDEX_FILE = path.join(VAULT_ANNOT, "annotations.json");
const PORT = 4322;

// GLM 配置：只从环境变量 / kb-site/.env 读取，凭据绝不写入代码（见需求文档 §6.3）
const ENV_FILE = path.join(import.meta.dirname ?? ".", "..", ".env");
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const GLM = {
  key: process.env.GLM_API_KEY ?? "",
  model: process.env.GLM_MODEL ?? "glm-4-flash",
  base: process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
};
console.log(`GLM 配置：key ${GLM.key ? `已加载（${GLM.key.length} 字符）` : "未配置"} · model=${GLM.model}`);

fs.mkdirSync(VAULT_ANNOT, { recursive: true });

const safeName = (s) => (s ?? "").replace(/[\\/:*?"<>|]/g, "").replace(/^\.+/, "").slice(0, 80) || "未命名";
// 体检 SEC-001/002 加固：浏览器允许任意网页向 localhost 发跨站请求（text/plain 简单请求
// 不经 preflight，ACAO 白名单拦不住"发送"），因此必须在业务逻辑前校验 Origin 与 Content-Type。
const OK_ORIGINS = new Set(["http://localhost:4321", "http://127.0.0.1:4321"]);
const readIndex = () => {
  // 体检 REL-001 加固：annotations.json 损坏时按空处理，不击穿进程
  try {
    return fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, "utf8")) : [];
  } catch (e) {
    console.error(`⚠️ annotations.json 解析失败，按空列表处理：${String(e).slice(0, 120)}`);
    return [];
  }
};
const writeIndex = (arr) => fs.writeFileSync(INDEX_FILE, JSON.stringify(arr, null, 2));

// 体检 SEC-002 加固：/explain 的 note 只允许 vault 内容目录内的相对路径（禁 ..、反斜杠、绝对路径）
const resolveNotePath = (note) => {
  const n = String(note ?? "");
  if (!n || n.includes("..") || n.includes("\\") || path.isAbsolute(n)) return null;
  const base = path.resolve(VAULT_CONTENT);
  const p = path.resolve(base, `${n}.md`);
  return p === base || p.startsWith(base + path.sep) ? p : null;
};

const json = (res, code, obj, req) => {
  const origin = req?.headers?.origin;
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin && OK_ORIGINS.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  });
  res.end(JSON.stringify(obj));
};

const server = http.createServer((req, res) => {
  try {
    const origin = req.headers.origin;
    // 无 Origin 头 = 非浏览器客户端（curl/本地调试）放行；带 Origin 则必须在白名单内
    if (origin && !OK_ORIGINS.has(origin)) return json(res, 403, { error: "origin 不被允许" }, req);
    if (req.method === "POST" && !/application\/json/i.test(String(req.headers["content-type"] ?? "")))
      return json(res, 415, { error: "Content-Type 必须为 application/json" }, req);
    if (req.method === "OPTIONS") return json(res, 204, {}, req);

    const url = new URL(req.url ?? "/", "http://127.0.0.1");

  // 读取某笔记的批注（前端回显）
  if (req.method === "GET" && url.pathname === "/annotations") {
    const note = url.searchParams.get("note") ?? "";
    const all = readIndex().filter((a) => a.note === note);
    return json(res, 200, all, req);
  }

  // 新批注落盘
  if (req.method === "POST" && url.pathname === "/annotate") {
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 100_000) req.destroy(); });
    req.on("end", () => {
      let body;
      try { body = JSON.parse(raw); } catch { return json(res, 400, { error: "bad json" }, req); }
      const { note, noteTitle, anchor, excerpt, question } = body;
      if (!note || !question) return json(res, 400, { error: "note 与 question 必填" }, req);
      const created = new Date().toISOString().slice(0, 16).replace("T", " ");
      const file = path.join(VAULT_ANNOT, `${safeName(noteTitle ?? note)}.md`);

      // md 文件：不存在则建头，存在则追加线程节
      if (!fs.existsSync(file)) {
        fs.writeFileSync(file, [
          "---",
          `note: "([[${noteTitle ?? note}]])"`,
          `anchor: "${anchor ?? ""}"`,
          `created: ${created.slice(0, 10)}`,
          "status: open",
          "---",
          "",
        ].join("\n"), "utf8");
      }
      fs.appendFileSync(file, [
        "",
        `### 我的疑问 | ${created}`,
        "",
        `> ${excerpt ?? ""}`,
        "",
        question,
        "",
      ].join("\n"), "utf8");

      const idx = readIndex();
      idx.push({ note, noteTitle, anchor, excerpt, question, created, status: "open" });
      writeIndex(idx);
      return json(res, 200, { ok: true, total: idx.length }, req);
    });
    return;
  }

  // GLM 讲解（需求 §6.3）：组装笔记上下文 → 调 GLM → 讲解回写批注文件 + 状态转 explained
  if (req.method === "POST" && url.pathname === "/explain") {
    if (!GLM.key) return json(res, 503, { error: "GLM_API_KEY 未配置：请在 kb-site/.env 填入后重启批注服务" }, req);
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 200_000) req.destroy(); });
    req.on("end", async () => {
      let body;
      try { body = JSON.parse(raw); } catch { return json(res, 400, { error: "bad json" }, req); }
      const { note, noteTitle, anchor, excerpt, question } = body;
      if (!note || !question) return json(res, 400, { error: "note 与 question 必填" }, req);

      // 上下文组装（分层预算 L1-L4）
      const ctxParts = [`【选中的原文】${excerpt ?? "（无）"}`];
      // 体检 SEC-002 修复：note 经 resolveNotePath 净化，路径逃逸直接 400
      const noteFile = resolveNotePath(note);
      if (!noteFile) return json(res, 400, { error: "note 含非法路径字符" }, req);
      if (fs.existsSync(noteFile)) {
        const md = fs.readFileSync(noteFile, "utf8");
        if (md.length < 4000) {
          ctxParts.push(`【笔记全文】\n${md}`);
        } else {
          const summary = md.match(/## 一句话总结\n([\s\S]*?)(?=\n## |$)/)?.[1]?.trim();
          if (summary) ctxParts.push(`【一句话总结】${summary}`);
          if (anchor) {
            const sec = md.match(new RegExp(`## ${anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n([\\s\\S]*?)(?=\\n## |$)`))?.[1];
            if (sec) ctxParts.push(`【所在小节】\n${sec.slice(0, 3000)}`);
          }
        }
      }
      // 批注线程历史（同笔记已有条目带上下文）
      const thread = readIndex().filter((a) => a.note === note).slice(-6);
      if (thread.length) {
        ctxParts.push(`【批注线程历史】\n${thread.map((a) => `问：${a.question}`).join("\n")}`);
      }

      const system = "你是嵌入个人知识库网页的学习讲解员。贴着用户笔记的上下文讲解，不编造笔记没有的内容；明确指出用户理解中对的部分与偏差；用中文；讲解结尾给 1-2 个值得追问的相邻问题。";
      try {
        const resp = await fetch(`${GLM.base}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${GLM.key}` },
          // 体检 REL-002 修复：30s 超时，防止上游挂起拖死请求与前端按钮
          signal: AbortSignal.timeout(30_000),
          body: JSON.stringify({
            model: GLM.model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: ctxParts.join("\n\n") + `\n\n【我的疑问】${question}` },
            ],
            temperature: 0.6,
          }),
        });
        if (!resp.ok) {
          const t = await resp.text();
          return json(res, 502, { error: `GLM API ${resp.status}: ${t.slice(0, 200)}` }, req);
        }
        const data = await resp.json();
        const explanation = data.choices?.[0]?.message?.content ?? "(空回复)";

        // 讲解回写批注 md + 索引状态转 explained
        const file = path.join(VAULT_ANNOT, `${safeName(noteTitle ?? note)}.md`);
        if (fs.existsSync(file)) {
          fs.appendFileSync(file, [``, `### 讲解 | ${new Date().toISOString().slice(0, 16).replace("T", " ")} · GLM`, ``, explanation, ``].join("\n"), "utf8");
        }
        const idx = readIndex();
        for (const a of idx) if (a.note === note && a.question === question && a.status === "open") a.status = "explained";
        writeIndex(idx);
        return json(res, 200, { explanation }, req);
      } catch (e) {
        return json(res, 502, { error: `GLM 调用失败：${String(e).slice(0, 200)}` }, req);
      }
    });
    return;
  }

  json(res, 404, { error: "not found" }, req);
  } catch (e) {
    // 体检 REL-001 修复：任何未捕获异常返回 500，不击穿进程
    console.error(`❌ ${req.method} ${req.url} 处理异常：`, e);
    try { json(res, 500, { error: "服务内部错误" }, req); } catch {}
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`✅ 批注服务 http://127.0.0.1:${PORT}（写入 ${VAULT_ANNOT}）`));
