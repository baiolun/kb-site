// 笔记链接统一出口（体检 USAB-001 修复）：路径式 id 中的 / 不能整体编码（%2F 会被
// astro preview/dev 拒绝），必须逐段 encodeURIComponent 后再 join。
import { withBase } from "./base";

export const noteHref = (id: string) =>
  withBase(`/notes/${id.split("/").map(encodeURIComponent).join("/")}/`);
