// tag 彩色（维护者反馈：更多颜色展示内容）——按名称 hash 从固定色板取色，
// 同名 tag 全站同色；颜色只作为 class/变量注入，实际显示色由 CSS 按
// color-mix(var(--tag-c), var(--ink)) 适配亮暗主题。
const PALETTE = [
  "#a63d2f", "#2c5e8a", "#6b8f5e", "#d97b4f", "#8e4a3e",
  "#3e8e8e", "#b08d3e", "#5e6d8a", "#c9a227", "#7a7a3e",
];

export const tagColor = (tag: string) =>
  PALETTE[[...tag].reduce((s, c) => s + c.charCodeAt(0), 0) % PALETTE.length];

import { withBase } from "./base";

export const tagHref = (tag: string) => withBase(`/tags/${encodeURIComponent(tag)}/`);
