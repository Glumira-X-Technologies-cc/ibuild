import React from 'react';
import type { ScreenProps } from './ui';
import Today from './Today';
import Diary from './Diary';
import BuildList from './BuildList';
import Library from './Library';
import Structure from './Structure';
import Estate from './Estate';
import Modules from './Modules';
import PromptKit from './PromptKit';
import Conscience from './Conscience';
import Resources from './Resources';

export type ScreenId = 'today' | 'diary' | 'build' | 'library' | 'structure' | 'estate' | 'modules' | 'prompt' | 'conscience' | 'resources';
export const SCREENS: Record<ScreenId, { label: string; tab: string; Component: React.FC<ScreenProps> }> = {
  today: { label: 'Today', tab: 'daily', Component: Today },
  diary: { label: 'Diary', tab: 'daily', Component: Diary },
  build: { label: 'Build list', tab: 'build', Component: BuildList },
  library: { label: 'Library', tab: 'build', Component: Library },
  structure: { label: 'Structure', tab: 'van-clief', Component: Structure },
  estate: { label: 'Estate', tab: 'van-clief', Component: Estate },
  modules: { label: 'Modules', tab: 'tools', Component: Modules },
  prompt: { label: 'Prompt kit', tab: 'tools', Component: PromptKit },
  conscience: { label: 'Conscience', tab: 'tools', Component: Conscience },
  resources: { label: 'Resources', tab: 'tools', Component: Resources },
};
export const MENU_TO_SCREEN: Record<string, ScreenId> = Object.fromEntries(
  (Object.entries(SCREENS) as [ScreenId, { label: string }][]).map(([id, s]) => [s.label, id])) as Record<string, ScreenId>;
export const SHORTCUTS: ScreenId[] = ['today', 'diary', 'build', 'library', 'structure', 'estate'];

export function Screen({ id, toast, resume, go, listFilter, idea }: { id: ScreenId; toast: (m: string) => void; resume?: ScreenProps['resume']; go?: ScreenProps['go']; listFilter?: ScreenProps['listFilter']; idea?: ScreenProps['idea'] }) {
  const { label, Component } = SCREENS[id];
  return (
    <div data-screen={id}>
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--border-color)]"><span className="label-text">{label}</span></div>
      <Component toast={toast} resume={resume} go={go} listFilter={listFilter} idea={idea} />
    </div>
  );
}
