export type UiLanguage = 'EN' | 'ZH';

export const visualLabels: Record<UiLanguage, Record<string, string>> = {
  EN: {
    'Video Flow': 'Video Flow',
    'Layered Stage': 'Layered Stage',
    Purple: 'Purple',
    'Blue Font': 'Liquid Interference',
    Pulse: 'Neon Pulse',
    Liquid: 'Liquid',
    Topology: 'Sonic Topology',
    Chromaflux: 'Chromaflux',
    Dumbar: 'Grey Glass',
    Void: 'Dark Space',
    Cyber: 'Cyber',
  },
  ZH: {
    'Video Flow': '视频流光',
    'Layered Stage': '分层舞台',
    Purple: '紫色流体',
    'Blue Font': '液态干涉',
    Pulse: '霓虹脉冲',
    Liquid: '液态梦境',
    Topology: '声波拓扑',
    Chromaflux: '色流热河',
    Dumbar: '灰玻璃方块',
    Void: '暗黑空间',
    Cyber: '赛博霓虹',
  },
};

export const visualDescriptions: Record<UiLanguage, Record<string, string>> = {
  EN: {
    'Video Flow': 'No-text cyan-violet ribbons with protected highlights',
    'Layered Stage': 'Low-cost layered DJ-reactive stage',
    Purple: 'Liquid holographic purple stream',
    'Blue Font': 'Liquid chrome blue typography',
    Pulse: 'Aggressive bass pulse and glitch',
    Liquid: 'Organic merging SDF fluid',
    Topology: 'Liquified contour type',
    Chromaflux: 'Thermal liquid river',
    Dumbar: 'Refractive glass blocks',
    Void: 'Monochrome void and sparse glitch',
    Cyber: 'Neon blue high-glitch scene',
  },
  ZH: {
    'Video Flow': '无文字青紫流带，高光受控并保留纹理',
    'Layered Stage': '低成本分层 DJ 响应舞台',
    Purple: '液态全息紫色流',
    'Blue Font': '蓝色液态金属文字',
    Pulse: '强烈低频脉冲与故障效果',
    Liquid: '有机融合 SDF 流体',
    Topology: '液化等高线形态',
    Chromaflux: '热成像液态河流',
    Dumbar: '折射灰玻璃方块',
    Void: '单色暗黑空间与稀疏故障',
    Cyber: '霓虹蓝高故障场景',
  },
};

export function getVisualLabel(language: UiLanguage, scene: string) {
  return visualLabels[language]?.[scene] || visualLabels.EN[scene] || scene;
}

export function getVisualDescription(language: UiLanguage, scene: string, fallback = '') {
  return visualDescriptions[language]?.[scene] || visualDescriptions.EN[scene] || fallback;
}
