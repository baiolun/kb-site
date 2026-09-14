// 笔记页左栏目录树：按 vault 真实目录层级（板块/子目录/笔记）构建，
// 体现笔记之间的层级关系（维护者反馈：左栏平铺列表丢失了层级感）。

export interface TreeNote {
  kind: "note";
  id: string;
  title: string;
}
export interface TreeDir {
  kind: "dir";
  name: string;
  path: string;
  children: TreeNode[];
}
export type TreeNode = TreeDir | TreeNote;

export function buildNoteTree(notes: { id: string; title: string }[]): TreeNode[] {
  const root: TreeDir = { kind: "dir", name: "", path: "", children: [] };
  const findOrCreate = (dir: TreeDir, name: string, path: string): TreeDir => {
    let child = dir.children.find((c): c is TreeDir => c.kind === "dir" && c.name === name);
    if (!child) {
      child = { kind: "dir", name, path, children: [] };
      dir.children.push(child);
    }
    return child;
  };
  for (const n of [...notes].sort((a, b) => a.id.localeCompare(b.id))) {
    const segs = n.id.split("/");
    let dir = root;
    for (let i = 0; i < segs.length - 1; i++) {
      dir = findOrCreate(dir, segs[i], segs.slice(0, i + 1).join("/"));
    }
    dir.children.push({ kind: "note", id: n.id, title: n.title });
  }
  // 目录在前、笔记在后，同类按名称排序（文件树惯例）
  const sortDir = (d: TreeDir): void => {
    d.children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      const an = a.kind === "dir" ? a.name : a.title;
      const bn = b.kind === "dir" ? b.name : b.title;
      return an.localeCompare(bn, "zh-Hans-CN");
    });
    for (const c of d.children) if (c.kind === "dir") sortDir(c);
  };
  sortDir(root);
  return root.children;
}
