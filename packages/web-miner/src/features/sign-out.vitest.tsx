import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { MasterRecord } from '../keys/store';
import { canSignOut, SignOutDialog } from './SignOutDialog';

const record = (patch: Partial<MasterRecord>): MasterRecord =>
  ({
    v: 1,
    id: 'r1',
    method: 'passkey',
    createdAt: 0,
    askEveryOpen: false,
    backedUp: false,
    account: { address: `0x${'282d'.padEnd(64, '9')}` },
    ...patch,
  }) as MasterRecord;

afterEach(cleanup);
beforeEach(() =>
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  })),
);

const mount = (r: MasterRecord) => {
  const onSignOut = vi.fn(() => Promise.resolve());
  const onBackUp = vi.fn();
  render(
    <SignOutDialog
      record={r}
      balance={48n * 10n ** 18n}
      open
      onOpenChange={() => {}}
      onSignOut={onSignOut}
      onBackUp={onBackUp}
    />,
  );
  return { onSignOut, onBackUp };
};

describe('sign out', () => {
  test('a passkey account: its note, the hold button, and the click path one link away; one forget per confirmation', () => {
    const { onSignOut } = mount(record({ method: 'passkey' }));
    expect(screen.getByText('Your passkey signs you back in.')).toBeDefined();
    expect(screen.getByTestId('sign-out-hold')).toBeDefined();
    expect(screen.queryByTestId('sign-out-click')).toBeNull();
    fireEvent.click(screen.getByTestId('sign-out-plain'));
    expect(screen.queryByTestId('sign-out-hold')).toBeNull();
    fireEvent.click(screen.getByTestId('sign-out-click'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('sign-out-click'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  test('a words account not backed up gets the backup path in place of both sign-out buttons', () => {
    const { onSignOut, onBackUp } = mount(record({ method: 'words', backedUp: false }));
    expect(screen.getByText('Back up the twelve words first.')).toBeDefined();
    expect(screen.queryByTestId('sign-out-hold')).toBeNull();
    expect(screen.queryByTestId('sign-out-plain')).toBeNull();
    fireEvent.click(screen.getByTestId('back-up-first'));
    expect(onBackUp).toHaveBeenCalledTimes(1);
    expect(onSignOut).not.toHaveBeenCalled();
    expect(canSignOut({ method: 'words', backedUp: false })).toBe(false);
    expect(canSignOut({ method: 'words', backedUp: true })).toBe(true);
    expect(canSignOut({ method: 'passkey', backedUp: false })).toBe(true);
  });

  test('a backed-up words account may sign out and is reminded to keep the words', () => {
    mount(record({ method: 'words', backedUp: true }));
    expect(screen.getByText('Make sure your twelve words are saved.')).toBeDefined();
    expect(screen.getByTestId('sign-out-hold')).toBeDefined();
    expect(screen.getByText(/48 tYACA stays on the chain/)).toBeDefined();
  });
});
