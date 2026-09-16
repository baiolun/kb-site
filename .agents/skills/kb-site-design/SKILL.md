---
name: kb-site-design
description: 知识库网页端（Astro 站点）的设计规范与流程约束。触发场景：为 kb-site 新建/修改任何页面或组件；做 design plan；选色/字体/动效；审查 UI 交货。核心：design tokens 多主题架构、主题甲「书房+星图」完整规格、中文排版硬指标、动效白名单、AI 默认审美黑名单。不触发：与该站点无关的前端任务。
---

# kb-site-design — 知识库站点设计规范

需求依据：`E:/ai/ku/knowledge-vault/网站/网页端需求.md`（v1.0）。本 skill 是它的设计约束层。

## 0. 铁律：design plan 先行

新页面/新组件，先交 design plan 再写码。四件套缺一不可：

1. **色板**（从本规范 tokens 取，新色需给理由）
2. **字体角色**（标题/正文/数据用哪档）
3. **ASCII 布局线框**（标出区块内容与优先级）
4. **signature 元素**（这个页面被人记住的那一个东西）

## 1. Design tokens 架构（多主题的地基）

所有颜色/字体/圆角/动效参数一律走 CSS 变量，**组件内禁止硬编码颜色字面量**。主题 = 一组 token 值（`data-theme` 属性切换）。v1 只交付 `theme-study`（书房+星图），tokens 结构从第一天按多主题组织。

```css
:root[data-theme="study"] {
  /* 层面变量：底/面/字/线 */
  --bg: #FAF6EF; --surface: #FFFFFF; --ink: #1C1C1C; --ink-2: #5A564E;
  --accent: #A63D2F; --link: #2C5E8A; --line: #E5DFD3;
  /* 字体角色 */
  --font-heading: "Source Han Sans SC", sans-serif;   /* 思源黑体 Heavy 字重 */
  --font-body: "Noto Serif SC", serif;                 /* 思源宋体 */
  --font-quote: "LXGW WenKai Screen", serif;           /* 霞鹜文楷：引文/callout */
  --font-mono: "Geist Mono", monospace;                /* 代码/数字 */
  /* 动效性格 */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast: 150ms; --dur-med: 200ms;
}
:root[data-theme="study"][data-space="map"] {
  /* 暗色子空间：图谱页/问题日志专用（星图感） */
  --bg: #16181D; --surface: #1E2028; --ink: #E2E2E2; --ink-2: #9A968E;
  --accent: #3FB950; --link: #58A6FF; --line: #2D3138;
}
```

**领域专属色**：每个领域一个色相，贯穿该领域所有页面（卡片边/标签/图谱节点）。在 `site-data/domains.json` 定义，token 名 `--domain-<slug>`。初始分配：GPU图形=绯红、金融=靛青、Web开发=植物绿、装机硬件=陶土橙、芯片=紫铜、网络原理=青、接口协议=黄铜、开发工具链=灰蓝、光学=金、软件驱动=橄榄。

## 2. 主题甲「书房+星图」性格

- **正文区=书房**：纸质感、衬线宋体、克制动效（无弹跳）；引文与 callout 用文楷制造手写温度
- **地图区=星图**：图谱页、问题日志时间线用暗色子空间；节点微光（低 blur，不发光标题）
- **生长徽章体系贯穿全站**：🌱 幼苗 / 🌿 含苞 / 🌳 常青，配 planted/last-tended 双时间戳（相对时间「3 天前」优先）。徽章是全站唯一的叙事符号，任何页面出现知识条目都带它
- **signature 转场**：图谱节点点击 → 节点飞变页首标题（View Transitions 共享元素；不支持时静默直跳）

## 3. 中文排版硬指标（交货必查）

- 正文 17-18px；行高 1.7-1.9；标题行高 1.2-1.4；行宽 25-35 汉字（正文列 max-width ≈ 700px）
- 段间距 ≥ 行距；一段 ≤6 行；每 3-5 段考虑小标题/卡片断节奏
- 中英混排：西文字体前置；中西文之间 1/4 em 间隙（`text-autospace` 渐进增强或 pangu 预处理）；等宽字号 ×0.9 视觉校正
- 暗色模式：禁纯白字（用 `#E2E2E2` 级暖灰白）；底色带色温不用纯黑；图片 `brightness(.85)`；正文对比度 ≥4.5:1
- 字体加载全走 `font-display: swap`；思源宋用 Google Fonts unicode-range 分片；文楷只用 screen-web 或 GB Lite 版且只做标题/引文

## 4. 动效白名单（之外的不做）

| 动效 | 规格 |
|---|---|
| 双链 popover 预览 | hover 延迟 150-250ms；opacity+translateY(4px)；ease-out 150-200ms；限宽限向防遮正文 |
| 图谱节点 hover | 邻接 opacity 1 / 非邻接 0.15 / 当前 scale 1.2；200ms |
| 图谱→正文转场 | 共享元素 morph（signature）；View Transitions same-document；不支持静默跳变 |
| 卡片 hover | translateY(-2~-4px)+阴影加深（阴影走 opacity 双层技巧）；150-200ms |
| 阅读进度+TOC spy | 顶部 2px 进度条（linear）；TOC 高亮切色 150ms |
| 生长徽章进场 | 页面载入播一次；scale 0.8→1 带 5-10% 过冲 spring 300-400ms |
| 列表进场 stagger | 30-50ms/项，总 <400ms；>12 项截断；SPA 返回不重播 |
| 主题切换 | clip-path 圆形揭幕 300-400ms（View Transition 实现；不支持瞬间切） |

硬约束：只动 transform/opacity；`prefers-reduced-motion` 一律降级为简单淡入或直跳；新增动效须过三问（删了丢什么/因果是什么/慢放三倍还成立吗）。

## 5. AI 默认审美黑名单（交货自检，逐条报告）

1. 紫蓝渐变主色 → 用 tokens
2. 发光/霓虹标题 → 标题永远哑光
3. 等距三卡片凑版式 → 布局由信息结构决定
4. 纯白 `#FFF` 正文（暗色）→ 暖灰白
5. 装饰性动画（与语义无关的飘浮/脉冲）→ 动效白名单外不做
6. emoji 当图标体系用（生长徽章除外——它是叙事符号）→ 图标走 icon 库
7. 行为文案含英文废话（"Oops!"/"Loading…"不翻译）→ 全站中文文案

## 6. 布局模式分配（IA 既定，不重开）

| 页面 | 布局 |
|---|---|
| 笔记详情 | 三栏：左领域树/中正文（分层视图）/右 TOC+反链+局部图谱 |
| 知识图谱 | 全屏暗色子空间+顶部悬浮控制条 |
| 问题日志 | 暗色子空间时间线+相邻问题连线 |
| 领域页 | 瑞士网格卡片陈列（领域色编码） |
| 首页 | hub：照料状态 hero+最近卡片流+快捷区+功夫值迷你图 |
| 学习路径 | roadmap 节点图（可打勾跟随）+knowledgeTree 树 |
| 归档 | 常规列表/卡片 |

分层视图（笔记详情核心）：一句话总结默认展开 → 核心 → 原理 → 例子 → 误区 逐层渐进披露，每层可独立锚链。

## 7. 数据可视化原则（R3 的落地准则）

- 每张图必须回答"看它的人获得了什么成就感"——为可视化而可视化的不做
- 图谱数据来自构建产物 `site-data/graph.json`（vault-web 生成），前端只渲染不解析 vault
- 功夫值：按板块时长条形图/日历热图；数据来自本地时长记录（localStorage → 导出 JSON）
- 中文节点文字渲染注意字体加载时机与碰撞避让
