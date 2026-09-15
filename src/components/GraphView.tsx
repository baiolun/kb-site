import { useEffect, useRef } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import Sigma from "sigma";
import data from "../data/graph.json";
import { domainColor } from "../lib/domains";
import { noteHref } from "../lib/noteHref";

// 知识星图：sigma.js + 领域着色 + hover 邻接高亮 + 渐进力导向入场 + 节点拖拽 + 点击下钻
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

    // ── hover：邻接亮、其余压暗（Obsidian 惯例）──
    let hovered: string | null = null;
    const applyDim = () => {
      const neighbors = hovered ? new Set(graph.neighbors(hovered)) : null;
      renderer.setSetting("nodeReducer", (node, attrs) => {
        if (hovered && node !== hovered && !neighbors?.has(node)) return { ...attrs, color: "#2a2e35", label: null };
        if (hovered && node === hovered) return { ...attrs, size: (attrs.size as number) * 1.3, zIndex: 1 };
        return attrs;
      });
      renderer.setSetting("edgeReducer", (edge, attrs) => {
        if (hovered && !graph.extremities(edge).some((n) => n === hovered || neighbors?.has(n))) return { ...attrs, hidden: true };
        return attrs;
      });
    };
    renderer.on("enterNode", ({ node }) => {
      hovered = node;
      applyDim();
    });
    renderer.on("leaveNode", () => {
      hovered = null;
      applyDim();
    });

    return () => {
      layoutDone = true;
      renderer.kill();
    };
  }, []);

  return <div ref={ref} style={{ width: "100%", height: "calc(100vh - 60px)" }} />;
}
