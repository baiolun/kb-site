---
name: vault-web
description: 知识库网页端的构建管线唯一入口。触发场景：vault 内容变更后要更新网站；建站/改管线；生成图谱索引/站点数据包；本地预览或构建站点；排查"页面缺笔记/链接断/索引少内容"。核心：vault 是唯一数据源，本 skill 把 markdown vault 编译成 Astro 站点的数据包。不触发：与 kb-site 无关的任务。
---

# vault-web — vault → 网站构建管线

需求依据：`E:/ai/ku/knowledge-vault/网站/网页端需求.md`（v1.0）。

## 0. 路径与架构约定

- vault（唯一数据源）：`E:/ai/ku/knowledge-vault/`
- 站点工程：`E:/ai/ku/kb-site/`（Astro + React 岛屿）
- 管线脚本：`E:/ai/ku/kb-site/pipeline/`（Node ≥22，pnpm）
- 数据流向：`vault/*.md → pipeline → kb-site/src/data/*.json + content → astro build → dist/`
- **vault 是唯一数据源；`src/data/` 下全部是生成物，禁止手改、禁止入 git**

## 1. 管线步骤（按序执行，任一步失败即停）

### 1.1 预处理（src: vault 原文 → 规范化 md）

1. **剥 BOM**：所有 `.md` 去掉开头 `\uFEFF`（不回写 vault！只在管线内存/中间目录处理）
2. **frontmatter 解析**：gray-matter + zod 宽松校验。已知两种惯例都要收：
   - A：`tags/created/aliases/related`
   - B：`tags/created/status/source`
   - 缺 `tags` 或 `created` → 记警告**不阻断**（警告清单输出到 `pipeline/warnings.json`，防静默掉出索引）
3. **slug 策略**：中文文件名/目录 → `{领域slug}/{笔记名}` 保留中文（Astro 原生支持），URL encode 统一一层；禁大小写变换（Windows/Linux 差异）

### 1.2 dataview 构建时重放

vault 内 4 篇 MoC + 模板用 ```` ```dataview ```` 查询（当前仅 `LIST FROM #tag SORT created ASC` 形态）。管线识别 dataview 代码块 → 用已解析的 frontmatter 在构建时执行等价查询 → 替换为静态列表 HTML。遇到不支持的查询语法 → 报错并列出（不要静默留空）。

### 1.3 双链图谱索引

- 扫全部 `[[wikilink]]`（含 aliases 解析）→ `src/data/graph.json`：`{ nodes: [{id, title, domain, tags, created, maturity?}], edges: [{source, target}] }`
- 反向链接索引 → `src/data/backlinks.json`
- 断链（指向不存在笔记）→ 记入 warnings，图谱中标记为虚节点

### 1.4 动态数据编译

- `07-学习路径/00-学习状态/progress.json` → 原样拷贝+校验 schema（learn-arch-progress-v1）
- `07-学习路径/00-问题日志/问题日志.md` → 解析 `## Qxxx` 节 → `src/data/questions.json`（id/date/状态/知识点双链/相邻问题）
- `网站/批注/` → 聚合 `src/data/annotations.json`
- 图片：vault `assets/` → 拷入站点 public（含 `![[嵌入]]` 引用改写）

### 1.5 内容上站清单（首次建站/新增板块时）

逐板块与维护者确认**过期内容**（维护者 2026-09-10 指示：vault 有过期内容，上站时点名清理）。清理=移出上站范围，**绝不删除 vault 原文件**。上站范围记录在 `pipeline/include.json`。

## 2. 命令约定

```bash
pnpm pipeline        # 全量：1.1→1.4，输出 warnings 摘要
pnpm pipeline:watch  # chokidar 监听 vault，防抖 3s 增量重建
pnpm dev             # pipeline + astro dev（localhost:4321）
pnpm build           # pipeline + astro build（纯静态导出）
```

## 3. 禁止事项

- ❌ 手改 `src/data/` 生成物（重跑管线会覆盖）
- ❌ 管线回写 vault 原文（vault 永远只被 Obsidian/kb-ask/维护者改）
- ❌ 跳过 warnings 检查就交货（缺笔记/断链必须报告）
- ❌ 把凭据写进任何配置/示例/测试（GLM key 只走环境变量/.env，.env 必须在 .gitignore）
- ❌ 静默吞错（dataview 不认识的语法、frontmatter 解析失败都要显式报告）

## 4. 环境已验证

Node v24.16.0 / pnpm 11.5.2（2026-09-10）。Astro 5 content collections 用 `glob()` loader 吃 vault 目录；wikilink 用 remark 自定义插件（@portaljs/remark-wiki-link 可参考，aliases/断链逻辑自己补）。
