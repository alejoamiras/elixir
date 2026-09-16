import { describe, expect, test } from 'bun:test';
import { OutboxAbi } from '@aztec/l1-artifacts/OutboxAbi';
import { BaseError, ContractFunctionRevertedError, encodeErrorResult } from 'viem';
import { yacanaPortalAbi } from './portal.ts';
import { errorName, explainRevert, revertLine, revertNameOf } from './revert.ts';

describe("a revert's name and its sentence", () => {
  test("the portal's and the Outbox's errors decode by name; an unknown selector is kept as is", () => {
    const headroom = encodeErrorResult({
      abi: yacanaPortalAbi,
      errorName: 'WaitsForHeadroom',
      args: [5n, 7n, 3n],
    });
    expect(errorName(headroom)).toBe('WaitsForHeadroom');
    const nullified = encodeErrorResult({
      abi: OutboxAbi,
      errorName: 'Outbox__AlreadyNullified',
      args: [2n, 9n],
    });
    expect(errorName(nullified)).toBe('Outbox__AlreadyNullified');
    expect(errorName('0xdeadbeef00')).toBe('0xdeadbeef');
    expect(errorName('0x')).toBe('empty');
  });

  test('a thrown viem revert is explained in the row’s words; anything else has no line', () => {
    const paused = new ContractFunctionRevertedError({
      abi: yacanaPortalAbi,
      functionName: 'forward',
      data: encodeErrorResult({ abi: yacanaPortalAbi, errorName: 'VersionPaused', args: [5n] }),
    });
    const thrown = new BaseError('call reverted', { cause: paused });
    expect(revertNameOf(thrown)).toBe('VersionPaused');
    expect(explainRevert(thrown, 'V5')).toBe('The bridge is paused: claims on Ethereum wait until it lifts.');
    expect(revertLine('DeadlinePassed', 'V5')).toMatch(/^V5’s last day passed/);
    expect(revertLine('NotOperators', 'V5')).toBeUndefined();
    expect(revertNameOf(new Error('the wallet said no'))).toBeUndefined();
    expect(explainRevert(new Error('the wallet said no'), 'V5')).toBeUndefined();
  });
});
