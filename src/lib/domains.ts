// 领域专属色（kb-site-design §1）。与 global.css 的 --domain-* 变量保持一致。
export const DOMAIN_COLORS: Record<string, string> = {
  "GPU与图形技术": "#a63d2f",
  "金融基础": "#2c5e8a",
  "Web开发": "#6b8f5e",
  "装机与硬件": "#d97b4f",
  "芯片半导体": "#8e4a3e",
  "网络原理": "#3e8e8e",
  "接口协议": "#b08d3e",
  "开发工具链": "#5e6d8a",
  "光学工程": "#c9a227",
  "软件与驱动": "#7a7a3e",
};
export const DEFAULT_COLOR = "#8a857b";
export const domainColor = (d: string) => DOMAIN_COLORS[d] ?? DEFAULT_COLOR;
