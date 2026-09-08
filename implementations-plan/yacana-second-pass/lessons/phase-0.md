# Phase 0 · planning (2026-09-07)

## Ask 1 · the example claim

Public storage holds no claim hashes and the deploy never claims, so the landing's ledger example has to come from a
real accepted claim. Sources tried: the soak's JSONL reports (`packages/deploy/target/soak-*.jsonl`, absent on this
machine), the lessons (no claim hashes recorded), the explorer's contract page (the "Public calls" tab renders from
`https://api.testnet.aztecscan.xyz/v1/temporary-api-key/l2/public-call-requests?contractAddress=<miner>`, which lists
80 calls; selector `0x3239d1fd` recurs, `0x6924e486` appears once, presumably the escape hatch).

Verification (probe run from `packages/deploy/target/`, against `v5.testnet.rpc.aztec-labs.com`): for each candidate
tx, `node.getTxEffect`, then scan epochs 0…199 for a `publicDataWrites` entry at
`computePublicDataTreeLeafSlot(miner, deriveStorageSlotInMap(claimsSlot, e))` and one at the `last_digest[e]` leaf,
and require `ticketNullifier(digestValue, miner)` in the effect's nullifiers. Two candidates both verified:

| tx | block | epoch | claims | ticket nullifier | note hash |
|---|---|---|---|---|---|
| `0x0cc85e677c17cf0d99c45beb71b84f820813db102ed0b0529c1a0203aae1cad5` | 73162 | 29 | 1 → 2 | `0x29b9adff02de2cfe6795d4aa007723143971ad2d6f751393a39e25209864b62f` | `0x1f31034eae0014e5522480a61cacb755abb67dd367e3a00db723e8580dcdc410` |
| `0x29d0e3bbcbb84a4eee5e76072eabecfc180711bfd1490a741c77de3eb92b1cf8` | 73160 | 29 | 0 → 1 | `0x031571a767f5504ef79fb9195b5e978cb0d07894fc205ecd47fdb97ec60eaf6d` | `0x2719fd4c2edc3b3f2cb992c2e35a913f210408797d00261e10de002e56cc1bd9` |

The first is the example (a mid-epoch claim reads better than the epoch's opener). Gotchas for the script:
`AztecAddress.fromString` does not exist on this SDK build, use `fromStringUnsafe`; `TxHash` comes from
`@aztec/stdlib/tx`; the effect exposes `data.publicDataWrites[].leafSlot` already as tree leaves, so the comparison is
leaf to leaf, never raw slot to leaf.
