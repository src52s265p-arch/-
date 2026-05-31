import { blueFontModule } from './blue-font';
import { chromafluxModule } from './chromaflux';
import { cyberModule } from './cyber';
import { dumbarModule } from './dumbar';
import { layeredStageModule } from './layered-stage';
import { liquidModule } from './liquid';
import { pulseModule } from './pulse';
import { purpleModule } from './purple';
import { topologyModule } from './topology';
import { videoFlowModule } from './video-flow';
import { voidModule } from './void';
import type { VisualLookDefaults, VisualModuleDefinition, VisualSceneId } from './types';

export const visualModules: VisualModuleDefinition[] = [
  videoFlowModule,
  layeredStageModule,
  purpleModule,
  blueFontModule,
  pulseModule,
  liquidModule,
  topologyModule,
  chromafluxModule,
  dumbarModule,
  voidModule,
  cyberModule,
];

export const liveVisualModules = visualModules;

export function getVisualModule(scene: string): VisualModuleDefinition | undefined {
  return visualModules.find((module) => module.id === scene || module.defaultLook.currentScene === scene);
}

export function getVisualModuleByPreset(presetId: string): VisualModuleDefinition | undefined {
  return visualModules.find((module) => module.presetId === presetId);
}

export function getPresetLook(presetId: string): VisualLookDefaults | null {
  return getVisualModuleByPreset(presetId)?.defaultLook ?? null;
}

export function isVisualSceneId(scene: string): scene is VisualSceneId {
  return Boolean(getVisualModule(scene));
}
