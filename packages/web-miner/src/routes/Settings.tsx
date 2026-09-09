import { useAtomValue, useSetAtom } from 'jotai';
import type * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Button,
  KvRow,
  Label,
  PowerSlider,
  Segmented,
  Switch,
  type Theme,
  Tile,
  TileBoundary,
  TileHeader,
  useTheme,
} from '../../../ui/src/index.ts';
import { NodeTile } from '../components/NodeTile';
import type { Connection } from '../config';
import type { MinerController } from '../controller';
import { diagnostics } from '../lib/diagnostics';
import { useTileLog } from '../lib/tile-log';
import { prestoAtom } from '../presto';
import { navigate } from '../routes';
import type { Session } from '../session';
import { type BooleanSetting, useSettings } from '../settings';
import { bootAtom, logAtom, signInAtom } from '../state';

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

/** The build's identity and the diagnostics copy: the log's last lines, host-only, for a bug report. */
function AboutTile({ log }: { log: string[] }) {
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  return (
    <Tile>
      <TileHeader>About</TileHeader>
      <KvRow label="source" value={import.meta.env.VITE_SOURCE_COMMIT.slice(0, 12)} />
      <KvRow label="build" value={import.meta.env.VITE_SITE_MODE} />
      <KvRow label="bb.js" value={import.meta.env.VITE_BB_VERSION} />
      <KvRow label="relying party" value={import.meta.env.VITE_RP_ID} />
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
        <Button
          size="sm"
          onClick={() =>
            navigator.clipboard
              .writeText(diagnostics(log))
              .then(() => setCopied('ok'))
              .catch(() => setCopied('failed'))
          }
          data-testid="copy-diagnostics"
        >
          {copied === 'ok' ? 'Copied' : 'Copy diagnostics (shortened)'}
        </Button>
        <span className="text-ink-3 text-xs">
          {copied === 'failed'
            ? 'The clipboard refused; the log is also in the browser console.'
            : "The last 200 lines, addresses shortened. It names this account's claims and the node's host."}
        </span>
      </div>
    </Tile>
  );
}

/** Threads for the browser prover; under Presto the setting is kept, dimmed, and Presto's own speed setting rules. */
function PerformanceTile({
  cores,
  threads,
  native,
  onThreads,
  flags,
}: {
  cores: number;
  threads: number;
  native: boolean;
  onThreads: (t: number) => void;
  flags: React.ReactNode;
}) {
  return (
    <Tile>
      <TileHeader>Performance</TileHeader>
      <KvRow
        label="prover"
        value={
          native ? (
            <span className="text-uv-2" data-testid="prover-native">
              <span className="text-uv">✦</span> Presto · native
            </span>
          ) : (
            `bb.js WASM · ${threads} threads`
          )
        }
      />
      <div className="mt-3 flex flex-col gap-2">
        <PowerSlider cores={cores} threads={threads} disabled={native} onChange={onThreads} />
        {native && (
          <p className="text-xs text-ink-2">
            Presto’s speed setting in its app decides the threads; this slider applies when proving in the
            browser.
          </p>
        )}
      </div>
      {flags}
    </Tile>
  );
}

/** A passkey account's convenience switch and its warning; the way in when no account is open. */
function AccountTile({ session }: { session: Session }) {
  const boot = useAtomValue(bootAtom);
  const openSignIn = useSetAtom(signInAtom);
  return (
    <Tile>
      <TileHeader>Account</TileHeader>
      {boot.phase === 'ready' && boot.record.method === 'passkey' ? (
        <>
          <Toggle
            id="stay-open"
            label="Stay open on this device"
            hint="off (default): one touch per open, no spend secret at rest · on: the account is sealed under a device key in this browser's storage (plaintext-equivalent against a stolen unencrypted disk)"
            value={!boot.record.askEveryOpen}
            onChange={(v) => void session.setStayOpen(v)}
          />
          <p className="mt-3 text-xs text-warn">
            A passkey account has no backup: if the passkey is lost and was not synced, so is the balance.
            Move funds off an account that holds more than a session's worth.
          </p>
        </>
      ) : (
        <>
          <p className="text-xs text-ink-2">Open an account to see its options.</p>
          {/* Settings stays free of the sign-in dialog (the node is changed here); this is the way in. */}
          <Button
            size="sm"
            variant="uv"
            className="mt-3"
            onClick={() => {
              openSignIn(true);
              navigate('mine');
            }}
            data-testid="sign-in-settings"
          >
            Sign in
          </Button>
        </>
      )}
    </Tile>
  );
}

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
  const { setTheme } = useTheme();
  const log = useAtomValue(logAtom);
  const onError = useTileLog();
  // The node in use follows a live switch; `connection` is what the page booted with.
  const [nodeUrl, setNodeUrl] = useState(session.nodeUrl ?? connection.nodeUrl);
  const cores = navigator.hardwareConcurrency || 2;
  const threads = s.threads ?? Math.max(1, cores - 1);
  const native = useAtomValue(prestoAtom).active === 'presto';
  useEffect(() => setTheme(s.theme), [s.theme, setTheme]);
  // Notifications need the browser's permission, asked for on the toggle (a user gesture).
  const toggle = async (k: BooleanSetting, v: boolean) => {
    if (k === 'notify' && v && typeof Notification !== 'undefined' && Notification.permission !== 'granted')
      if ((await Notification.requestPermission()) !== 'granted') return;
    set({ [k]: v });
  };
  const flag = (k: BooleanSetting, id: string, label: string, hint?: string, disabled?: boolean) => (
    <Toggle
      id={id}
      label={label}
      hint={hint}
      value={s[k]}
      onChange={(v) => void toggle(k, v)}
      disabled={disabled}
    />
  );
  const canPip = 'documentPictureInPicture' in window;
  const canBattery = 'getBattery' in navigator;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TileBoundary name="node" onError={onError}>
        <NodeTile
          session={session}
          nodeUrl={nodeUrl}
          onSwitched={() => setNodeUrl(session.nodeUrl ?? nodeUrl)}
        />
      </TileBoundary>
      <TileBoundary name="performance" onError={onError}>
        <PerformanceTile
          cores={cores}
          threads={threads}
          native={native}
          onThreads={(t) => {
            set({ threads: t });
            controller()?.reconfigure(t);
          }}
          flags={
            <>
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
            </>
          }
        />
      </TileBoundary>
      <TileBoundary name="behaviour" onError={onError}>
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
      </TileBoundary>
      <TileBoundary name="account" onError={onError}>
        <AccountTile session={session} />
      </TileBoundary>
      <TileBoundary name="appearance" onError={onError}>
        <Tile>
          <TileHeader>Appearance</TileHeader>
          <Segmented
            value={s.theme}
            onChange={(theme) => set({ theme })}
            options={THEMES}
            aria-label="theme"
          />
        </Tile>
      </TileBoundary>
      <TileBoundary name="about" onError={onError}>
        <AboutTile log={log} />
      </TileBoundary>
    </div>
  );
}
