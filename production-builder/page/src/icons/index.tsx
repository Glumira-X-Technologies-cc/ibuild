// Streamline Core Line icons (CC BY 4.0, https://streamlinehq.com). See LICENSE.md.
// SVG files in ./svg are the originals from github.com/webalys-hq/streamline-vectors
// (core/line), with #000000 swapped for currentColor so they follow text colour.
import shield1 from './svg/shield-1.svg?raw';
import bug from './svg/bug.svg?raw';
import arrowReloadHorizontal1 from './svg/arrow-reload-horizontal-1.svg?raw';
import brightness1 from './svg/brightness-1.svg?raw';
import waningCresentMoon from './svg/waning-cresent-moon.svg?raw';
import arrowDown2 from './svg/arrow-down-2.svg?raw';
import circleClock from './svg/circle-clock.svg?raw';
import add1 from './svg/add-1.svg?raw';
import voiceMail from './svg/voice-mail.svg?raw';
import delete1 from './svg/delete-1.svg?raw';
import layoutPanes from './svg/layout-panes.svg?raw';

const RAW = {
  shield: shield1,
  bug,
  reload: arrowReloadHorizontal1,
  sun: brightness1,
  moon: waningCresentMoon,
  'arrow-down': arrowDown2,
  clock: circleClock,
  add: add1,
  microphone: voiceMail,
  close: delete1,
  layout: layoutPanes,
} as const;

export type IconName = keyof typeof RAW;

// Drop the <desc> block and make the root fill its wrapper.
const prepared: Record<string, string> = {};
for (const [k, v] of Object.entries(RAW)) {
  prepared[k] = v
    .replace(/<desc>[\s\S]*?<\/desc>/, '')
    .replace(/<svg\b/, '<svg width="100%" height="100%" aria-hidden="true" focusable="false"');
}

export function Icon({ name, size = 16, className = '', title }: {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: prepared[name] }}
    />
  );
}

export default Icon;
