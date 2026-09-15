import { useEffect, useRef } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import Sigma from "sigma";
import data from "../data/graph.json";
import { domainColor } from "../lib/domains";
import { noteHref } from "../lib/noteHref";

// hex/rgb 颜色插值（hover 明度渐变用，避免瞬变闪眼）
const toRgb = (c: string): [number, number, number] => {
  const s = c.startsWith("rgb") ? (c.match(/\d+/g) ?? ["0", "0", "0"]).map(Number) : [0, 2, 4].map((i) => parseInt(c.replace("#", "").slice(i, i + 2), 16));
  return [s[0] ?? 0, s[1] ?? 0, s[2] ?? 0];
};
const mix = (a: string, b: string, t: number) => {
  const A = toRgb(a), B = toRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
};
const DIM_TARGET = "#14161b"; // 压暗目标：比背景更深一档

// 知识星图：sigma.js + 领域着色 + hover 明度渐变压暗 + 渐进力导向入场 + 节点拖拽 + 点击下钻
export default function GraphView() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const graph = new Graph({ multi: false, type: "undirected" });
    const deg: Record<string, number> = {};
    for (const e of data.edges) {
      deg[e.source] = (deg[e.source] ?? 0) + 1;
      deg[e.target] = (deg[e.target] ?? 0) + 1;
    }

    for (const n of data.nodes) {
      const angle = Math.random() * Math.PI * 2; // 仅布局初始散布，非加密用途
      graph.addNode(n.id, {
        label: n.title,
        size: 4 + Math.min((deg[n.id] ?? 0) * 1.2, 10),
        color: domainColor(n.domain),
        x: Math.cos(angle),
        y: Math.sin(angle),
        domain: n.domain,
      });
    }
    for (const e of data.edges) if (!graph.hasEdge(e.source, e.target)) graph.addEdge(e.source, e.target, { size: 1, color: "#2d3138" });

    const renderer = new Sigma(graph, container, {
      allowInvalidContainer: true,
      minCameraRatio: 0.1,
      maxCameraRatio: 10,
      labelFont: '"Noto Sans SC", sans-serif',
      labelSize: 12,
      labelColor: { color: "#9a968e" },
      defaultEdgeType: "line",
      // 缩小视图时自动隐藏小节点标签，避免文字重叠（Obsidian 图谱惯例）
      labelRenderedSizeThreshold: 8,
      labelDensity: 1,
    });

    // ── 渐进力导向：节点从中心逐帧散开成簇（Obsidian 图谱的生成感），而非一次性算好 ──
    const settings = forceAtlas2.inferSettings(graph);
    let frames = 0;
    let layoutDone = false;
    const tick = () => {
      if (layoutDone) return;
      forceAtlas2.assign(graph, { iterations: 2, settings });
      frames += 2;
      if (frames < 160) requestAnimationFrame(tick);
      else layoutDone = true;
    };
    requestAnimationFrame(tick);

    // ── 节点拖拽（Obsidian 惯例）：拖动节点改变坐标，拖过的节点抑制本次点击导航 ──
    let draggedNode: string | null = null;
    let suppressClick = false;
    renderer.on("downNode", ({ node }) => {
      draggedNode = node;
      suppressClick = false;
      graph.setNodeAttribute(node, "highlighted", true);
    });
    renderer.on("mousemovebody", (e) => {
      if (!draggedNode) return;
      const pos = renderer.viewportToGraph(e);
      graph.setNodeAttribute(draggedNode, "x", pos.x);
      graph.setNodeAttribute(draggedNode, "y", pos.y);
      suppressClick = true;
      layoutDone = true; // 拖拽视为手动布局，停止自动收敛
      e.preventSigmaDefault();
      e.original?.preventDefault();
    });
    const endDrag = () => {
      if (draggedNode) graph.removeNodeAttribute(draggedNode, "highlighted");
      draggedNode = null;
    };
    renderer.on("mouseup", endDrag);
    renderer.on("clickNode", ({ node }) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      window.location.href = noteHref(node);
    });

    // ── hover 明度渐变压暗（维护者反馈：不要瞬变）：dim 0→1 逐帧插值，
    //    节点/标签/边都按 dim 与暗色插值，邻接与悬停节点保持原色 ──
    let hovered: string | null = null;
    let hoveredNeighbors: Set<string> | null = null;
    let animHandle = 0;
    const dim = new Map<string, number>();
    const targetDim = (node: string) => (hovered && node !== hovered && !hoveredNeighbors?.has(node) ? 1 : 0);
    const startAnim = () => {
      cancelAnimationFrame(animHandle);
      const step = () => {
        let settled = true;
        for (const n of graph.nodes()) {
          const t = targetDim(n);
          const cur = dim.get(n) ?? 0;
          const next = Math.abs(t - cur) < 0.03 ? t : cur + (t - cur) * 0.16;
          if (next !== cur) {
            dim.set(n, next);
            if (Math.abs(t - next) >= 0.03) settled = false;
          }
        }
        renderer.refresh();
        if (!settled) animHandle = requestAnimationFrame(step);
      };
      animHandle = requestAnimationFrame(step);
    };
    renderer.setSetting("nodeReducer", (node, attrs) => {
      if (hovered && node === hovered) return { ...attrs, size: (attrs.size as number) * 1.3, zIndex: 1 };
      const d = dim.get(node) ?? 0;
      if (d <= 0.01) return attrs;
      return {
        ...attrs,
        color: mix(attrs.color as string, DIM_TARGET, d),
        labelColor: mix("#9a968e", DIM_TARGET, d),
      };
    });
    renderer.setSetting("edgeReducer", (edge, attrs) => {
      if (!hovered) return attrs;
      const [a, b] = graph.extremities(edge);
      const d = Math.max(dim.get(a) ?? 0, dim.get(b) ?? 0);
      if (d <= 0.01) return attrs;
      return { ...attrs, color: mix(attrs.color as string, DIM_TARGET, d) };
    });
    renderer.on("enterNode", ({ node }) => {
      hovered = node;
      hoveredNeighbors = new Set(graph.neighbors(node));
      startAnim();
    });
    renderer.on("leaveNode", () => {
      hovered = null;
      hoveredNeighbors = null;
      startAnim();
    });

    return () => {
      layoutDone = true;
      cancelAnimationFrame(animHandle);
      renderer.kill();
    };
  }, []);

  return <div ref={ref} style={{ width: "100%", height: "calc(100vh - 60px)" }} />;
}
