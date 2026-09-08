import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { NodeProbe } from '../../../site/src/browser/node.ts';
import type { Session } from '../session';
import { NodeTile } from './NodeTile';

const probe: NodeProbe = {
  chainId: 31337n,
  rollupVersion: 5n,
  rollupAddress: '0xab',
  block: 73164,
  blockAgeS: 3,
  latencyMs: 210,
};
const IN_USE = 'https://node.example/rpc';
const OTHER = 'https://other.example/rpc';

const session = (over: Partial<Session> = {}) =>
  ({
    nodeUrl: IN_USE,
    probeNode: vi.fn(async (url: string) => {
      if (url === OTHER) return { ...probe, latencyMs: 96 };
      return probe;
    }),
    switchNode: vi.fn(async () => {}),
    ...over,
  }) as unknown as Session;

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('the Node tile', () => {
  test('shows the node in use with its health and the default marker', async () => {
    vi.stubEnv('VITE_AZTEC_NODE_URL', IN_USE);
    render(<NodeTile session={session()} nodeUrl={IN_USE} onSwitched={() => {}} />);
    expect(screen.getByTestId('node-in-use').textContent).toContain('node.example');
    await waitFor(() =>
      expect(screen.getByTestId('node-health').textContent).toContain('block 73,164 · 3 s ago'),
    );
    expect(screen.getByTestId('node-health').textContent).toContain('this deployment ✓');
    expect((screen.getByTestId('node-use') as HTMLButtonElement).disabled).toBe(true);
  });

  test('Check shows the probe’s lines and enables Use; a refusal reads in warn; Use switches', async () => {
    vi.stubEnv('VITE_SITE_MODE', 'e2e');
    const s = session();
    const onSwitched = vi.fn();
    render(<NodeTile session={s} nodeUrl={IN_USE} onSwitched={onSwitched} />);
    fireEvent.change(screen.getByTestId('node-url'), { target: { value: 'http://not-local.example' } });
    fireEvent.click(screen.getByTestId('node-check'));
    await waitFor(() => expect(screen.getByTestId('node-check-result').textContent).toMatch(/over https/));
    expect(screen.getByTestId('node-check-result').className).toContain('text-warn');
    expect((screen.getByTestId('node-use') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByTestId('node-url'), { target: { value: OTHER } });
    expect(screen.queryByTestId('node-check-result')).toBeNull();
    fireEvent.click(screen.getByTestId('node-check'));
    await waitFor(() =>
      expect(screen.getByTestId('node-check-result').textContent).toContain('✓ chain 31337'),
    );
    expect(screen.getByTestId('node-check-result').textContent).toContain('96 ms');
    expect((screen.getByTestId('node-use') as HTMLButtonElement).disabled).toBe(false);

    await act(() => fireEvent.click(screen.getByTestId('node-use')));
    await waitFor(() => expect(s.switchNode).toHaveBeenCalledWith(OTHER));
    expect(JSON.parse(localStorage.getItem('yacana.connection') ?? '{}')).toEqual({ nodeUrl: OTHER });
    await waitFor(() => expect(onSwitched).toHaveBeenCalled());
    expect(screen.getByTestId('node-check-result').textContent).toContain('in use');
  });

  test('a storage write the browser refuses shows the fixed message and does not switch', async () => {
    vi.stubEnv('VITE_SITE_MODE', 'e2e');
    const s = session();
    render(<NodeTile session={s} nodeUrl={IN_USE} onSwitched={() => {}} />);
    fireEvent.change(screen.getByTestId('node-url'), { target: { value: OTHER } });
    fireEvent.click(screen.getByTestId('node-check'));
    await waitFor(() => expect((screen.getByTestId('node-use') as HTMLButtonElement).disabled).toBe(false));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    await act(() => fireEvent.click(screen.getByTestId('node-use')));
    await waitFor(() =>
      expect(screen.getByTestId('node-check-result').textContent).toMatch(/refused to save/),
    );
    expect(s.switchNode).not.toHaveBeenCalled();
  });

  test('renders with no session state at all (a failed preflight): the probe’s error is shown', async () => {
    const s = session({
      nodeUrl: undefined,
      probeNode: vi.fn(async () => {
        throw new Error('node is on chain 1, this build expects 31337');
      }),
    } as Partial<Session>);
    render(<NodeTile session={s} nodeUrl={IN_USE} onSwitched={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('node-health').textContent).toContain('on chain 1'));
  });
});
