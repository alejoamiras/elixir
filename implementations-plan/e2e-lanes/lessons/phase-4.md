# Phase 4 lessons — trim the rig, if P1 says it is worth it

**Verdict (2026-09-10): not built.** P1 put the rig at 10% of the run (113 s local, 163 s CI) and named its parts: the two deployments are 85 s local / 115 s CI of it, the network 25–29 s, prebuild 0.3 s local / 14 s CI (the CRS download), Presto's start 0.5 s, the bundle 2–3 s. The two flags the plan proposed cannot touch that:

- **Skip Presto** saves 0.5 s. Not a flag's worth.
- **Skip the impossible-target deployment** saves ~39 s local / ~53 s CI per run — but every shard in `e2e/shards.json` needs it: `cockpit` for the power test, `chain` for the node-away and words tests, `accounts` for two Presto tests. The hard-target tests are spread across files, and P2 shards by file, so no shard can drop it. Regrouping tests across files for a 40-second saving would move the suite around for the trim's sake.
- **Deploying both in parallel** (tried, `Promise.all` over two `deployYacana` calls with their own wallets) fails at the node with `NULLIFIER_CONFLICT`: the first deployment of each contract class publishes the class, and two transactions publishing the same class collide in the mempool. Making it work means publishing the classes first and deploying after — more rig, not less. Reverted.

What would actually cut the rig is out of this plan's scope: a faster local network, or one deployment shared by all shards, which separate networks per shard rule out. Leaving the rig alone; the sharding already divides the test time, which is 90% of the job.

- The "fail loudly rather than degrade" half of P4 is covered elsewhere now: a Presto that is missing makes `presto.e2e.ts` skip, and a skipped test fails its shard's inventory check (P2), so the silent degradation the plan worried about cannot pass CI.
