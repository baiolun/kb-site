# 问野（kb-site）

个人知识库网站：[https://baiolun.github.io/kb-site/](https://baiolun.github.io/kb-site/)

Astro 5（静态输出 + content layer）+ React 岛屿（sigma.js 知识星图）+ Pagefind 全文搜索。
内容源是 [knowledge-vault](https://github.com/baiolun/knowledge-vault)（Obsidian 库），构建时经 `pipeline/parse-vault.mjs` 解析上站，vault 永远是唯一数据源，`src/content/vault/` 与 `src/data/` 均为生成物（禁手改，已 gitignore）。

## 本地开发

```bash
pnpm install
pnpm dev        # 解析 vault + 启动 dev server（http://localhost:4321）
pnpm build      # 解析 vault + astro build + pagefind 索引 dist/
pnpm preview    # 预览构建产物（base 为 /kb-site，访问 http://localhost:4321/kb-site/）
```

辅助服务（可选，仅本地批注工作流）：

```bash
pnpm annotate   # 批注服务（:4322），站上批注优先落盘 vault，失败自动降级 localStorage
```

## 部署（GitHub Pages）

`.github/workflows/deploy.yml`：push 到 `master` 触发（也可手动 workflow_dispatch）。
Actions 里会同时 checkout 私有仓库 `baiolun/knowledge-vault`（需要 repo secret `VAULT_TOKEN`：具备读该仓库权限的 PAT），跑 `pnpm build` 后发布到 Pages。

首次启用：仓库 Settings → Pages → Source 选 **GitHub Actions**。

## 构建管线要点（pipeline/parse-vault.mjs）

- 上站范围由 `INCLUDE_DIRS` 控制；`EXCLUDE_FILES` 排除同步测试残留/空文件；**绝不删除 vault 原文件**
- frontmatter 非法（如 Windows 路径反斜杠）降级为无 frontmatter 并计入 `pipeline/warnings.json`
- dataview `LIST FROM #tag` 构建时重放为静态链接；`TABLE/TASK` 等不支持形态降级为占位注释（warning 可见，不阻断构建）
- wikilink 解析失败渲染为灰色不可点文本（Obsidian「待写笔记」惯例），计入 `broken-link` 警告清单
- 正文首个与标题重复的 H1 会被剔除（页面已有标题栏）
- 站点 `base` 为 `/kb-site`（GitHub Pages 项目子路径），管线内 `BASE` 常量与 `astro.config.mjs` 保持一致；CI 用环境变量 `VAULT_DIR` 指向 vault 检出位置

## 约定

- 设计规范见 `E:/ai/ku/.agents/skills/kb-site-design/SKILL.md`（design tokens、动效白名单、中文排版硬指标、AI 审美黑名单）
- vault 内容变更 → 网站更新走 `vault-web` skill 流程；学习循环走 `kb-ask`
- 提交信息用中文，一行说清「哪块 + 改了什么」
