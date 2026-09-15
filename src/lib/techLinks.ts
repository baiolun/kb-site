// 技术术语 → 官网链接（维护者反馈：相关内容要有真实数据来源）。
// 命中规则保守：笔记标题或别名与 key 完全相等才出链接，避免正文误链。
export interface TechLink {
  name: string;
  url: string;
}

const OFFICIAL: Record<string, string> = {
  // GPU 与图形
  "DLSS": "https://www.nvidia.com/en-us/geforce/technologies/dlss/",
  "Deep Learning Super Sampling": "https://www.nvidia.com/en-us/geforce/technologies/dlss/",
  "FSR": "https://www.amd.com/en/products/software/fidelityfx-super-resolution.html",
  "FidelityFX Super Resolution": "https://www.amd.com/en/products/software/fidelityfx-super-resolution.html",
  "XeSS": "https://www.intel.com/content/www/us/en/products/docs/processors/tech/xess.html",
  "Xe Super Sampling": "https://www.intel.com/content/www/us/en/products/docs/processors/tech/xess.html",
  "CUDA": "https://developer.nvidia.com/cuda-zone",
  "Vulkan": "https://www.vulkan.org/",
  "DirectX": "https://www.microsoft.com/download/details.aspx?id=35",
  "DirectX 12": "https://learn.microsoft.com/en-us/windows/win32/direct3d12/directx-12-programming-guide",
  "光线追踪": "https://www.nvidia.com/en-us/geforce/technologies/rtx/",
  "Ray Tracing": "https://www.nvidia.com/en-us/geforce/technologies/rtx/",
  "Tensor Core": "https://www.nvidia.com/en-us/data-center/tensor-cores/",
  // 接口与硬件
  "PCIe": "https://pcisig.com/",
  "CXL": "https://www.computeexpresslink.org/",
  "Thunderbolt": "https://www.thunderbolttechnology.net/",
  "雷雳": "https://www.thunderbolttechnology.net/",
  "USB4": "https://www.usb.org/",
  // 工具链
  "Obsidian": "https://obsidian.md/",
  "Git": "https://git-scm.com/",
  "React": "https://react.dev/",
  "Astro": "https://astro.build/",
  "Docker": "https://www.docker.com/",
  "Node.js": "https://nodejs.org/",
  "Python": "https://www.python.org/",
  "Linux": "https://kernel.org/",
  "VSCode": "https://code.visualstudio.com/",
  "Claude Code": "https://claude.com/product/claude-code",
  // 协议
  "HTTP": "https://developer.mozilla.org/zh-CN/docs/Web/HTTP",
  "RESTful API": "https://developer.mozilla.org/zh-CN/docs/Web/API",
};

export function officialLinks(title: string, aliases: string[]): TechLink[] {
  const out: TechLink[] = [];
  const seen = new Set<string>();
  for (const name of [title, ...aliases]) {
    const url = OFFICIAL[name];
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push({ name, url });
    }
  }
  return out;
}
