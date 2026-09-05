import { useAtomValue } from 'jotai';
import { useEffect } from 'react';
import {
  KvRow,
  Label,
  PowerSlider,
  Segmented,
  Switch,
  type Theme,
  Tile,
  TileHeader,
  useTheme,
} from '../../../ui/src/index.ts';
import { ConnectionCard } from '../components/ConnectionCard';
import type { Connection } from '../config';
import type { MinerController } from '../controller';
import type { Session } from '../session';
import { type BooleanSetting, useSettings } from '../settings';
import { bootAtom, logAtom } from '../state';

function Toggle({
  id,
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-2.5 first:border-t-0">
      <Label htmlFor={id} className="flex-col items-start gap-1">
        <span className="text-ink">{label}</span>
        {hint && <span className="text-xs font-normal text-ink-2">{hint}</span>}
      </Label>
      <Switch id={id} checked={value} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

const THEMES: { value: Theme; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

export function Settings({
  connection,
  controller,
  session,
}: {
  connection: Connection;
  controller: () => MinerController | undefined;
  session: Session;
}) {
  const [s, set] = useSettings();
  const boot = useAtomValue(bootAtom);
  const { setTheme } = useTheme();
  const log = useAtomValue(logAtom);
  const cores = navigator.hardwareConcurrency || 2;
  const threads = s.threads ?? Math.max(1, cores - 1);
  useEffect(() => setTheme(s.theme), [s.theme, setTheme]);
  const flag = (k: BooleanSetting, id: string, label: string, hint?: string, disabled?: boolean) => (
    <Toggle
      id={id}
      label={label}
      hint={hint}
      value={s[k]}
      onChange={(v) => set({ [k]: v })}
      disabled={disabled}
    />
  );
  const canPip = 'documentPictureInPicture' in window;
  const canBattery = 'getBattery' in navigator;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Tile>
        <TileHeader>Performance</TileHeader>
        <PowerSlider
          cores={cores}
          threads={threads}
          onChange={(t) => {
            set({ threads: t });
            controller()?.reconfigure(t);
          }}
        />
        {flag(
          'pauseOnBattery',
          'pause-battery',
          'Pause on battery',
          canBattery ? undefined : 'not reported by this browser',
          !canBattery,
        )}
        {flag(
          'backgroundProving',
          'background',
          'Keep proving in a background tab',
          'off: mining pauses while the tab is hidden',
        )}
      </Tile>
      <Tile>
        <TileHeader>Behaviour</TileHeader>
        {flag('resumeOnOpen', 'resume', 'Resume mining when the page opens')}
        {flag('notify', 'notify', 'Notify on a win', 'no amounts in the notification')}
        {flag('sound', 'sound', 'Sound on a win')}
        {flag('tabStatus', 'tab-status', 'Report in the tab title and icon')}
        {flag(
          'pip',
          'pip',
          'Mini window',
          canPip ? 'Document Picture-in-Picture' : 'not supported by this browser',
          !canPip,
        )}
      </Tile>
      <Tile>
        <TileHeader>Key</TileHeader>
        {boot.phase === 'ready' && boot.record.method === 'passkey' ? (
          <>
            <Toggle
              id="stay-open"
              label="Stay open on this device"
              hint="off (default): one touch per open, no spend secret at rest · on: the key is sealed under a device key in this browser's storage (plaintext-equivalent against a stolen unencrypted disk)"
              value={!boot.record.askEveryOpen}
              onChange={(v) => void session.setStayOpen(v)}
            />
            <p className="mt-3 text-xs text-warn">
              A passkey key has no backup: if the passkey is lost and was not synced, so is the balance. Move
              funds off a key that holds more than a session's worth.
            </p>
          </>
        ) : (
          <p className="text-xs text-ink-2">Open a key to see its options.</p>
        )}
      </Tile>
      <Tile>
        <TileHeader>Appearance</TileHeader>
        <Segmented value={s.theme} onChange={(theme) => set({ theme })} options={THEMES} aria-label="theme" />
      </Tile>
      <Tile>
        <TileHeader>About</TileHeader>
        <KvRow label="source" value={import.meta.env.VITE_SOURCE_COMMIT.slice(0, 12)} />
        <KvRow label="build" value={import.meta.env.VITE_SITE_MODE} />
        <KvRow label="bb.js" value={import.meta.env.VITE_BB_VERSION} />
        <KvRow label="relying party" value={import.meta.env.VITE_RP_ID} />
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-ink-2">diagnostics</summary>
          <pre className="mt-2 max-h-48 overflow-auto font-mono text-2xs text-ink-2" data-testid="log">
            {log.length ? log.join('\n') : 'nothing yet'}
          </pre>
        </details>
      </Tile>
      <div className="md:col-span-2">
        <ConnectionCard connection={connection} />
      </div>
    </div>
  );
}
