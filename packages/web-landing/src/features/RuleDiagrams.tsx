// The six pictures under the FAQ's rules, as drawn: the exit limit over time, the pause budget,
// a version's life, who may do what, the forward rule, the three bridges. Numbers come from the
// portal's policy and the build's version; the geometry is the drawing's, prose that wraps stays
// HTML. Every colour is a token, so the pictures follow the theme.
import { policyFor } from '@yacana/bridge/policy';
import { PARAMS } from '@yacana/miner-core/generated/params';
import { amount } from '@yacana/web-kit/browser/format';

export type DiagramId =
  | 'exit-limit'
  | 'pause-budget'
  | 'version-life'
  | 'who-may'
  | 'forward-rule'
  | 'three-bridges';

const symbol = PARAMS.TOKEN_SYMBOL;
const policy = policyFor();
const whole = (raw: bigint) => amount(raw, PARAMS.DECIMALS, 0);
const days = (seconds: bigint) => Number(seconds / 86_400n);

/** This version and the two after it by name (V5, V6, V7) on a build that knows its Registry index; plain words otherwise. */
export const versionTrio = (): [string, string, string] => {
  const index = import.meta.env.VITE_VERSION_INDEX;
  if (!index) return ['this version', 'the next version', 'the one after'];
  const i = Number(index);
  return [`V${i}`, `V${i + 1}`, `V${i + 2}`];
};

type Tone = 'ink' | 'ink-2' | 'ink-3' | 'uv-2' | 'ok' | 'warn' | 'bad';
const FILL: Record<Tone, string> = {
  ink: 'fill-ink',
  'ink-2': 'fill-ink-2',
  'ink-3': 'fill-ink-3',
  'uv-2': 'fill-uv-2',
  ok: 'fill-ok',
  warn: 'fill-warn',
  bad: 'fill-bad',
};
const STROKE: Record<Tone, string> = {
  ink: 'stroke-ink',
  'ink-2': 'stroke-ink-2',
  'ink-3': 'stroke-ink-3',
  'uv-2': 'stroke-uv-2',
  ok: 'stroke-ok',
  warn: 'stroke-warn',
  bad: 'stroke-bad',
};

/** A label in the drawing: mono by default, `sans` for a heading line; `b` for the emphasised ones. */
function T({
  x,
  y,
  tone = 'ink-3',
  b,
  sans,
  end,
  mid,
  rotate,
  children,
}: {
  x: number;
  y: number;
  tone?: Tone;
  b?: boolean;
  sans?: boolean;
  end?: boolean;
  mid?: boolean;
  rotate?: number;
  children: React.ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={end ? 'end' : mid ? 'middle' : undefined}
      transform={rotate === undefined ? undefined : `rotate(${rotate} ${x} ${y})`}
      className={`${FILL[tone]} ${sans ? 'font-sans text-[13px]' : 'font-mono text-[11px]'} ${b ? 'font-medium' : ''}`}
    >
      {children}
    </text>
  );
}

function Frame({ label, height, children }: { label: string; height: number; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 880 ${height}`}
        className="h-auto w-full min-w-[640px]"
        role="img"
        aria-label={label}
        data-testid="rule-diagram"
      >
        {children}
      </svg>
    </div>
  );
}

function Caption({ items }: { items: { swatch: string; term: string; text: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 font-mono text-[11px] leading-[1.3] text-ink-3">
      {items.map((i) => (
        <span key={i.term}>
          <i aria-hidden className={`mr-1.5 inline-block size-2.5 rounded-[2px] align-[-1px] ${i.swatch}`} />
          <b className="font-medium text-ink-2">{i.term}</b> {i.text}
        </span>
      ))}
    </div>
  );
}

/** A row under a picture: a dot (filled green may, hollow red may not), a bold term, its text. */
function Who({ may, term, children }: { may: boolean; term: string; children: React.ReactNode }) {
  return (
    <span className="flex items-baseline gap-2.5 text-xs leading-[1.5] text-ink-2">
      <i
        aria-hidden
        className={`mt-1 inline-block size-3 shrink-0 self-start rounded-full border-2 ${may ? 'border-ok bg-ok' : 'border-bad'}`}
      />
      <span>
        <b className={`font-medium ${may ? 'text-ink' : 'text-bad'}`}>{term}</b> {children}
      </span>
    </span>
  );
}

function ExitLimit() {
  return (
    <div className="flex flex-col gap-2.5">
      <Frame label="The exit limit over time" height={330}>
        <defs>
          <linearGradient id="rule-below" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--uv)" stopOpacity=".22" />
            <stop offset="1" stopColor="var(--uv)" stopOpacity=".04" />
          </linearGradient>
        </defs>
        <line x1="70" y1="290" x2="800" y2="290" className="stroke-line-2" />
        <line x1="70" y1="60" x2="70" y2="290" className="stroke-line-2" />
        <path d="M70 240 L540 110 L800 110 L800 290 L70 290 Z" fill="url(#rule-below)" />
        <path d="M70 240 L540 110 L800 110" fill="none" className="stroke-uv" strokeWidth="2.5" />
        <line x1="540" y1="60" x2="540" y2="290" className="stroke-warn" strokeDasharray="4 4" />
        <T x={540} y={50} mid tone="warn" b>
          the upgrade
        </T>
        <T x={76} y={262} tone="uv-2" b>
          {whole(policy.allowance)} {symbol} at launch
        </T>
        <T x={300} y={202} tone="uv-2" b rotate={-15}>
          +{whole(policy.perHour)} {symbol} an hour
        </T>
        <T x={556} y={132} tone="warn" b>
          frozen at the upgrade
        </T>
        <T x={70} y={312}>
          launch
        </T>
        <T x={800} y={312} end>
          later
        </T>
        <T x={22} y={230} tone="ink-2" rotate={-90}>
          {symbol} that may leave
        </T>
        <circle cx="400" cy="240" r="6" className="fill-ok" />
        <T x={414} y={236} tone="ok" b>
          below the limit
        </T>
        <T x={414} y={252} tone="ok">
          leaves now
        </T>
        <circle cx="180" cy="116" r="6" fill="none" className="stroke-warn" strokeWidth="2" />
        <T x={194} y={104} tone="warn" b>
          above the limit
        </T>
        <T x={194} y={120} tone="warn">
          waits for it to grow
        </T>
        <circle cx="720" cy="78" r="6" fill="none" className="stroke-bad" strokeWidth="2" />
        <T x={708} y={74} end tone="bad" b>
          beyond the frozen limit
        </T>
        <T x={708} y={90} end tone="bad">
          cannot leave
        </T>
      </Frame>
      <Caption
        items={[
          {
            swatch: 'bg-uv',
            term: 'the limit',
            text: 'what mining could have produced by now, net of what came back',
          },
          {
            swatch: 'border border-dashed border-warn',
            term: 'the upgrade',
            text: 'the next version becomes canonical',
          },
        ]}
      />
    </div>
  );
}

function PauseBudget() {
  const max = days(policy.pauseMax);
  const budget = days(policy.pauseBudget);
  const w = 720;
  const first = (w * max) / budget;
  const second = (w * 8) / budget;
  return (
    <Frame label="The pause budget" height={260}>
      <T x={60} y={34} sans tone="ink">
        The bound the contract fixes: {budget} days per version, {max} a call
      </T>
      <rect x="60" y="48" width={w} height="26" rx="4" className="fill-line stroke-line-2" />
      <rect x="60" y="48" width={first} height="26" rx="4" className="fill-warn/25 stroke-warn" />
      <T x={70} y={65} tone="warn" b>
        1st call · {max} days, the most one call may hold
      </T>
      <rect
        x={60 + first + 12}
        y="48"
        width={second}
        height="26"
        rx="4"
        className="fill-warn/25 stroke-warn"
      />
      <T x={60 + first + 20} y={65} tone="warn" b>
        2nd · 8 d
      </T>
      <T x={60 + first + second + 24} y={65} tone="ink-2">
        {budget - max - 8} days left in the budget
      </T>
      <T x={60} y={94}>
        0
      </T>
      <T x={60 + first - 12} y={94}>
        {max} d
      </T>
      <T x={60 + w - 12} y={94}>
        {budget} d
      </T>
      <T x={60} y={134} sans tone="ink">
        What a pause holds, and what it cannot
      </T>
      <T x={60} y={156} tone="ink-2">
        holds: withdrawals leaving, deposits arriving, forwards leaving for the next version
      </T>
      <T x={60} y={174} tone="ink-2">
        cannot: keep a withdrawal from landing once it lifts, or take anything back
      </T>
      <T x={60} y={214} sans tone="ink">
        Every paused day pushes the version’s last day by a day
      </T>
      <line x1="60" y1="238" x2="640" y2="238" className="stroke-line-2" />
      <line x1="640" y1="228" x2="640" y2="248" className="stroke-ink-3" />
      <T x={560} y={224} tone="ink-2">
        last day
      </T>
      <path d="M640 238 L744 238" className="stroke-warn" strokeWidth="2" strokeDasharray="4 3" />
      <line x1="744" y1="228" x2="744" y2="248" className="stroke-warn" />
      <T x={654} y={256} tone="warn">
        +{max + 8} paused days
      </T>
    </Frame>
  );
}

function VersionLife() {
  const [v, next, after] = versionTrio();
  const floor = days(policy.exitFloor);
  const marks: { x: number; label: string; subs: [string, string]; tone: Tone; filled: boolean }[] = [
    { x: 70, label: 'launched', subs: ['epoch 0 opens', 'mining begins'], tone: 'ok', filled: true },
    {
      x: 240,
      label: `${next} announced`,
      subs: ['send ahead', 'before the upgrade'],
      tone: 'ok',
      filled: true,
    },
    {
      x: 410,
      label: 'the upgrade',
      subs: [`${next} canonical`, `mining on ${v} ends`],
      tone: 'uv-2',
      filled: true,
    },
    {
      x: 580,
      label: `${v} goes quiet`,
      subs: ['its last proof', 'unproven: undone'],
      tone: 'ink-3',
      filled: false,
    },
    {
      x: 780,
      label: 'the last day',
      subs: ['the portal stops', `honouring ${v}`],
      tone: 'bad',
      filled: false,
    },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      <Frame label="A version’s life" height={260}>
        <line x1="70" y1="70" x2="780" y2="70" className="stroke-line-2" />
        <line x1="70" y1="70" x2="410" y2="70" className="stroke-ok" strokeWidth="2" />
        {marks.map((m) => (
          <g key={m.label}>
            <circle
              cx={m.x}
              cy="70"
              r="6"
              className={`${STROKE[m.tone]} ${m.filled ? FILL[m.tone] : ''}`}
              fill={m.filled ? undefined : 'none'}
              strokeWidth="2"
            />
            <T x={m.x} y={50} mid tone={m.tone === 'ink-3' ? 'ink' : m.tone} b>
              {m.label}
            </T>
            <T x={m.x} y={96} mid tone="ink-2">
              {m.subs[0]}
            </T>
            <T x={m.x} y={112} mid tone="ink-2">
              {m.subs[1]}
            </T>
          </g>
        ))}
        <T x={70} y={168} sans tone="ink">
          The last day is the later of two dates, plus every paused day
        </T>
        <line x1="70" y1="212" x2="800" y2="212" className="stroke-line" />
        <line x1="410" y1="200" x2="410" y2="224" className="stroke-uv-2" />
        <T x={410} y={244} mid tone="uv-2">
          the upgrade
        </T>
        <path d="M410 212 L640 212" className="stroke-warn" strokeWidth="2" />
        <line x1="640" y1="200" x2="640" y2="224" className="stroke-warn" />
        <T x={640} y={244} mid tone="warn">
          + {floor} days, the floor
        </T>
        <line x1="720" y1="200" x2="720" y2="224" className="stroke-warn" />
        <T x={720} y={192} mid tone="warn">
          {after} arrives
        </T>
        <path d="M720 212 L780 212" className="stroke-bad" strokeWidth="2" strokeDasharray="4 3" />
        <line x1="780" y1="200" x2="780" y2="224" className="stroke-bad" />
        <T x={782} y={244} mid tone="bad" b>
          + paused
        </T>
      </Frame>
    </div>
  );
}

const WHO: {
  action: string;
  note?: string;
  multisig?: 'once' | 'yes';
  anyone?: true;
  holder?: true;
  relayer?: true;
}[] = [
  { action: 'register a version', note: 'once per version, never changed', multisig: 'once' },
  {
    action: 'pause withdrawals and deposits',
    note: `${days(policy.pauseMax)} d a call · ${days(policy.pauseBudget)} d per version`,
    multisig: 'yes',
  },
  { action: 'authorize a relayer', multisig: 'yes' },
  { action: 'close deposits before an upgrade', multisig: 'yes' },
  {
    action: 'claim a withdrawal on Ethereum',
    note: 'the caller pays the gas',
    anyone: true,
    holder: true,
  },
  { action: 'claim on Aztec', note: 'one tap, fee sponsored', holder: true },
  {
    action: 'forward a send-ahead to the next version',
    note: 'one-way: it gives up the redeem',
    holder: true,
    relayer: true,
  },
  { action: 'redeem a held send-ahead on Ethereum', holder: true },
];

function Mark({ value }: { value: 'once' | 'yes' | undefined }) {
  if (!value) return <span />;
  return (
    <span className={`font-mono text-xs ${value === 'once' ? 'text-uv-2' : 'text-ok'}`}>
      {value === 'once' ? 'once' : '●'}
    </span>
  );
}

function WhoMay() {
  const h = 'label-mono pb-1.5 flex items-end';
  const c = 'flex min-h-[38px] items-center border-t border-line px-2.5 py-2';
  return (
    <div className="flex flex-col gap-2.5">
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[760px] grid-cols-[2fr_repeat(4,minmax(0,1fr))] text-[13px]"
          data-testid="rule-diagram"
        >
          <div className={h}>action</div>
          <div className={h}>governance multisig</div>
          <div className={h}>anyone</div>
          <div className={h}>the holder</div>
          <div className={h}>an authorized relayer</div>
          {WHO.map((r) => (
            <div key={r.action} className="contents">
              <div className={`${c} flex-col !items-start justify-center gap-0.5`}>
                <span>{r.action}</span>
                {r.note && <span className="font-mono text-[11px] text-ink-3">{r.note}</span>}
              </div>
              <div className={c}>
                <Mark value={r.multisig} />
              </div>
              <div className={c}>
                <Mark value={r.anyone ? 'yes' : undefined} />
              </div>
              <div className={c}>
                <Mark value={r.holder ? 'yes' : undefined} />
              </div>
              <div className={c}>
                <Mark value={r.relayer ? 'yes' : undefined} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 font-mono text-[11px] leading-[1.3] text-ink-3">
        <span>
          <b className="font-medium text-ink-2">●</b> may
        </span>
        <span>
          <b className="font-medium text-uv-2">once</b> may, once per version
        </span>
        <span>
          the governance multisig is the Safe named in the record; an authorized relayer is an address it
          lists
        </span>
      </div>
    </div>
  );
}

function ForwardRule() {
  const [, next, after] = versionTrio();
  return (
    <div className="flex flex-col gap-3">
      <Frame label="The forward rule" height={110}>
        <rect x="40" y="20" width="330" height="70" rx="8" className="fill-panel stroke-uv-2" />
        <T x={205} y={46} mid tone="ink" b>
          held on Ethereum
        </T>
        <T x={205} y={66} mid tone="ink-2">
          your send-ahead, proven; still yours to redeem
        </T>
        <rect x="510" y="20" width="330" height="70" rx="8" className="fill-panel stroke-ok" />
        <T x={675} y={46} mid tone="ok" b>
          {next} · the live version
        </T>
        <T x={675} y={66} mid tone="ink-2">
          the only place the portal forwards to
        </T>
        <path d="M370 55 L502 55" className="stroke-ink-3" strokeWidth="2" />
        <path d="M496 49 L506 55 L496 61" fill="none" className="stroke-ink-3" strokeWidth="2" />
        <T x={440} y={42} mid tone="ink-2">
          forward · one way
        </T>
        <T x={440} y={76} mid tone="ink-2">
          then no redeem
        </T>
      </Frame>
      <b className="text-[13px] font-semibold">Who may take that step</b>
      <div className="flex flex-col gap-1.5">
        <Who may term="you">
          with a signature that names {next}; once {after} has arrived the portal refuses it and you sign
          again
        </Who>
        <Who may term="an authorized relayer">
          an address the multisig lists; Yacana runs one and forwards by hand
        </Who>
        <Who may={false} term="anyone else">
          cannot: the portal refuses a forward without your signature or a listed caller
        </Who>
      </div>
    </div>
  );
}

type Station = [label: string, sub: string, kind: 'private' | 'public' | 'held'];

function Lane({ y, title, stations }: { y: number; title: string; stations: Station[] }) {
  const gap = (740 - 120) / (stations.length - 1);
  return (
    <g>
      <T x={60} y={y - 22} sans tone="ink">
        {title}
      </T>
      {stations.map(([label, sub, kind], i) => {
        const cx = 120 + i * gap;
        return (
          <g key={label}>
            {i < stations.length - 1 && (
              <line x1={cx + 8} y1={y} x2={cx + gap - 8} y2={y} className="stroke-line-2" />
            )}
            <circle
              cx={cx}
              cy={y}
              r="6"
              fill={kind === 'held' ? 'none' : undefined}
              className={kind === 'private' ? 'fill-uv' : kind === 'public' ? 'fill-ink-3' : 'stroke-uv-2'}
              strokeWidth="1.5"
            />
            <T x={cx} y={y + 22} mid tone="ink" b>
              {label}
            </T>
            <T x={cx} y={y + 38} mid tone="ink-2">
              {sub}
            </T>
          </g>
        );
      })}
    </g>
  );
}

function ThreeBridges() {
  const [v, next] = versionTrio();
  return (
    <div className="flex flex-col gap-2.5">
      <Frame label="The three bridges" height={360}>
        <Lane
          y={60}
          title="Bridge to Ethereum · a withdrawal"
          stations={[
            ['burned here', 'private · 20 s', 'private'],
            ['proven', 'with its epoch · ~1 h', 'private'],
            ['claim on Ethereum', 'you · one transaction', 'public'],
            ['YACA', 'public · an ERC-20', 'public'],
          ]}
        />
        <Lane
          y={180}
          title="Bridge from Ethereum · a deposit"
          stations={[
            ['deposit', 'your wallet · one transaction', 'public'],
            ['crossing', 'minutes', 'public'],
            ['claim on Aztec', 'one tap · fee sponsored', 'private'],
            [symbol, 'private · in your account', 'private'],
          ]}
        />
        <Lane
          y={300}
          title={`Send ahead · ${v} to ${next} through Ethereum`}
          stations={[
            ['sent ahead', 'burned here · 20 s', 'private'],
            ['held on Ethereum', 'proven · out of reach', 'held'],
            ['forwarded', 'you, or a relayer', 'held'],
            ['landed', 'claim there · one tap', 'private'],
          ]}
        />
      </Frame>
      <Caption
        items={[
          { swatch: 'bg-uv', term: 'private', text: 'on Aztec, yours alone to see' },
          {
            swatch: 'bg-ink-3',
            term: 'public',
            text: 'on Ethereum, the amount and the address readable by anyone',
          },
          {
            swatch: 'border-[1.5px] border-uv-2',
            term: 'held',
            text: 'on Ethereum, waiting for the next version',
          },
        ]}
      />
    </div>
  );
}

export const DIAGRAMS: Record<DiagramId, { title: string; Picture: () => React.JSX.Element }> = {
  'exit-limit': { title: 'the exit limit', Picture: ExitLimit },
  'pause-budget': { title: 'the pause budget', Picture: PauseBudget },
  'version-life': { title: 'a version’s life', Picture: VersionLife },
  'who-may': { title: 'who may do what', Picture: WhoMay },
  'forward-rule': { title: 'the forward rule', Picture: ForwardRule },
  'three-bridges': { title: 'the three bridges', Picture: ThreeBridges },
};
