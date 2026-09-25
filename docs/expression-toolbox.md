# 表达优化手段调研（expression toolbox）

> 2026-09-25 由调研 agent 核查产出（KaTeX/Shiki/Obsidian 兼容性均经官方文档确认；未确认项已在文中标注"需本地验证"）。
> 场景：本站 Astro 5 静态 + content layer 渲染 + DOM 侧渐进转换既定模式（callout/KaTeX/mermaid 已实践）+ 单人维护 + 源文件需在 Obsidian 保持可读。
> 目标：让概念、机制、对比关系被更高效地理解。

## 使用原则

**上图表/交互的唯一理由：内容本身是空间性、过程性或参数性的。** 流程、时序、拓扑、多方交互 → 图；随参数变化的行为 → 滑块演示；多方案横向比较 → 对比表/四象限。反之，定义、观点、叙事、事实记录，纯文字永远最快——强行可视化的成本是双份的（制作 + 未来维护），且遮挡重点。**默认纯文字，图是例外；同一手段先做成可复用模板再批量用**，避免每篇新写 JS。

## 总览表

| 手段 | 理解增益 | 接入成本 | 备注 |
|---|---|---|---|
| mermaid 进阶图型 + themeVariables | ⭐⭐ | 低 | 零新代码，扩表达面最广 |
| Shiki 注释标注高亮（diff/focus/词高亮） | ⭐⭐ | 低 | 源文件在 Obsidian 无损 |
| 脚注 + kbd + details 折叠 | ⭐ | 低 | 纯语法，半天内完成 |
| KaTeX 进阶（aligned/pmatrix/cases/cancel/mhchem） | ⭐⭐ | 低 | 追加一个 mhchem 脚本 |
| 对比表排版规范 + 长表折叠 | ⭐⭐ | 低 | 纪律问题，非技术问题 |
| checkbox 切换图层对比 | ⭐⭐ | 低 | 纯 CSS `:checked` 可零 JS |
| Starlight 式 Tabs/Steps 组件 | ⭐⭐ | 中 | 复用 callout 客户端转换模式 |
| 表格客户端排序/筛选 | ⭐ | 中 | 只对少数长表值得 |
| 参数滑块 SVG 演示 | ⭐⭐⭐ | 中 | 首个交互，做成模板 |
| 滚动逐步呈现（scrubber/stepwise） | ⭐⭐⭐ | 中偏高 | distill 核心手法 |
| Expressive Code 全套接管 | ⭐⭐ | 中 | 与现有 Shiki CSS 冲突 |
| Ciechanowski 级深度交互 | ⭐⭐⭐ | 高 | 每篇数周，仅代表作使用 |

## 一、可视化解释标杆：可提炼的手法

**逐步构建（Jay Alammar, [Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/)）**：把一个机制拆成 5–10 个小图，每图只新增一个元素、配一句话；同一概念全站固定同色。核心是画图纪律而非技术，纯静态即可实现，增益极高。

**滚动/步进叙事（[distill.pub](https://distill.pub)）**：一个 figure 挂多个状态，读者点"下一步"或滚动推进，每个状态对应一段文字。静态实现：SVG 多状态 + 按钮/range 控制 class 切换（~100 行可复用脚本），边际成本在画 SVG 状态图。

**可操作参数（[explorabl.es](https://explorabl.es/)）**：把"反直觉结论"做成滑块，读者自己调出结论。见第七节。

**自研深度交互（[Bartosz Ciechanowski](https://ciechanow.ski/archives/)）**：无框架、纯 JS 也能做顶级交互——但他每篇投入数周，单人库只适合 1–2 篇"镇馆"文章，不作为常规手段。

**Observable 的可借鉴点**是"叙述—代码—输出交织"，不是引入其运行时。

## 二、mermaid 进阶（已接入，重点是用好）

**值得用的图型**：`sequenceDiagram`（协议/API 调用时序）、`classDiagram`（类型与继承关系）、`gitGraph`（版本/分支演化）、`quadrantChart`（**双维度概念定位**，最适合"对比关系"——如"实现成本 × 理解增益"本表本身）、`timeline`（事件线）。`pie` 信息密度低，少用。`xychart-beta` 观察：Obsidian 1.6.x 内置 mermaid 约 10.9，已支持上述全部图型，但滞后于官方 12（[论坛讨论](https://forum.obsidian.md/t/is-there-a-list-of-supported-mermaid-diagram-types-anywhere/62721)），新语法先在 Obsidian 内预览验证再用。

**样式**：`%%{init: {'theme':'base','themeVariables':{'primaryColor':'#xxx'}}}%%` 定制配色；`classDef important fill:#...` + `class node1 important` 给节点分级强调——比手写 style 可维护。用 themeVariables 时给亮暗主题各留一份映射（与本站现有 mermaid 主题切换机制并存，themeVariables 会覆盖全局主题变量，注意不要写死深色底）。

**Obsidian 兼容注意**：`%%{init}%%` 在代码块内与 Obsidian 的 `%%` 注释不冲突；避免依赖 flowchart 内嵌 HTML 和 `click callback`（静态站只可用 `click node href "url"`）。

## 三、表格的表达力

**markdown 表格做不了**：合并单元格、排序、筛选、逐行高亮语义。合并单元格可用内嵌 HTML 表（Obsidian 与 Astro 都渲染），但手写成本高，仅用于无法回避的场景。

**对比表排版纪律**（最划算的一节）：首列放比较维度、每列一个方案；单元格只写短语或 ✓/✗/—，句子收进脚注；≤8 行一屏放下，超过就拆表或折叠；关键结论行用简单 CSS 类强调。**超过 3 个维度的对比，考虑改画 quadrantChart**。

**轻量增强**：DOM 侧对 `table` 做点击表头排序（~40 行 JS，与 callout 转换同模式），只对确实超过一屏的长表启用（如文献清单）；普通表不动。

## 四、公式排版（KaTeX）

已核实（[官方支持表](https://katex.org/docs/supported)）：`\cancel{}`/`\bcancel`/`\xcancel`（约去项、化简过程）、`aligned`（多行推导对齐）、`pmatrix`/`bmatrix`/`cases` 均为**内置**，直接可用，适合表达变换推导和分段定义。**mhchem**（`\ce{H2O}` 化学式）是官方扩展：在现有 auto-render 渐进加载链上追加一个 `contrib/mhchem.min.js` 脚本即可，按需决定是否接入。

**暗色主题**：KaTeX 文字继承页面 `color`，暗色下自动适配，无需处理；坑在于源文件里写死 `\textcolor{#333}{...}` 这类深色——需要语义色时选中等亮度色，或交给 CSS 类。

## 五、代码块表达力

**Shiki 注释标注**（[transformers 文档](https://shiki.style/packages/transformers)）：`transformerNotationDiff/Highlight/Focus/WordHighlight/ErrorLevel`，在代码里写 `// [!code highlight]`、`// [!code ++]`、`// [!code word:xxx]` 即生效。**最大优点：标注只是注释，Obsidian 源文件完全无损**。接入：`markdown.shikiConfig.transformers` 追加（Astro 5 content layer 的 `render()` 是否应用全局 markdown 配置——官方文档未取得直接引文，需先用一篇文章验证；不生效则退回 DOM 侧转换，与 callout 同模式）。transformers 只输出 class，需补少量 CSS（diff 底色、focus 变暗）。

**[Expressive Code](https://expressive-code.com/)**：`npx astro add astro-expressive-code` 一条命令接入，提供 frame 标题（```ts title="x.ts"）、`ins=/del=/mark=` 行标记（写在 fence meta，Obsidian 中同样无损）、复制按钮、可折叠段落插件。代价：接管全部代码块渲染管线，输出 DOM 与现有 Shiki 不同，代码块 CSS 需重写一遍——与"DOM 侧渐进"模式相悖。**建议先用 Shiki transformers 拿到 80% 收益，不满足再考虑 EC。**

## 六、排版组件（借鉴 Starlight，[组件参考](https://starlight.astro.build/components/)）

值得借鉴的：**Steps**（有序列表 + CSS counter 圆点编号，~30 行 CSS，适合操作序列）；**Tabs**（多方案/多语言平行示例，切换比折叠利于对比，~40 行客户端 JS，可复用 callout 转换模式）。**Aside 不必做**——本站 callout 已等价。Badge/LinkCard 锦上添花，缓。不建议直接 import `@astrojs/starlight` 组件（有运行时耦合），照思路自写精简版。

零成本三件套，直接用：**脚注** `[^1]`（Astro 内置 GFM、Obsidian 原生支持——出处、旁注、术语展开的正规位置）；**`<details>/<summary>`**（推导过程、长清单折叠；内部 markdown 前需空行）；**`<kbd>`**（快捷键，两端均渲染内联 HTML）。

## 七、轻量交互（纯静态，无重前端）

**checkbox 切换图层**（成本低，优先做）：`<input type=checkbox>` + CSS `:checked ~` 兄弟选择器控制 SVG 图层显隐——如"开/关注意力权重层""显示/隐藏梯度流"。可零 JS。

**参数滑块 + SVG**（增益最高的交互）：`<input type=range>` + 几十行 JS 更新 SVG 属性，适合"参数→行为"类机制（阈值效应、学习率影响、衰减曲线）。做法：写一个可复用脚本块，之后每篇只写 SVG + 参数映射，不再新写 JS。

**滚动进入渐现**：IntersectionObserver 加 class + CSS 过渡，弱增益，仅用于步进叙事场景；CSS scroll-driven animation 兼容性不齐，不用。

**脚注悬浮预览**：[littlefoot](https://github.com/goblindegook/littlefoot)（~2KB），点击脚注原地弹出，distill 手法的低成本近似。

## 建议接入顺序

1. **mermaid 进阶图型 + classDef/themeVariables**：零新代码，一次性补齐时序、类型关系、四象限对比的表达能力，覆盖面最大。
2. **Shiki notation transformers + 补充 CSS**：代码笔记是知识库高频内容，注释语法对 Obsidian 无损，半天可完成；先验证 content layer 是否吃全局 shikiConfig，不吃则走 DOM 侧。
3. **零成本三件套 + 对比表纪律**：脚注/kbd/details/表格规范全部是语法和习惯问题，当天完成，长期收益稳定。

第 4 步再做**滑块 SVG 演示模板**（首个自定义交互，做成模板后边际成本递减）。EC、表格排序、Starlight Tabs/Steps 观察实际需求再定；Ciechanowski 级交互留给未来某一篇代表作。
