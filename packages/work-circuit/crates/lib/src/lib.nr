use poseidon::poseidon2::Poseidon2;

// Domain separators: the ASCII bytes of the tag, big-endian. Every Poseidon2 invocation in the
// system starts with one of these so no two hashes can collide across roles. The TS mirror in
// miner-core is pinned to these values by fixture.
pub global DOM_DEPLOY: Field = 0x454c582f6465706c; // "ELX/depl"
pub global DOM_SECRET: Field = 0x454c582f73656372; // "ELX/secr"
pub global DOM_WORK: Field = 0x454c582f776f726b; // "ELX/work"
pub global DOM_TICKET: Field = 0x454c582f7469636b; // "ELX/tick"
pub global DOM_NULL: Field = 0x454c582f6e756c6c; // "ELX/null"
pub global DOM_SEED: Field = 0x454c582f73656564; // "ELX/seed"

// The work: a Poseidon2 chain of length L seeded by every public input. The nonce is absorbed
// first so no wire polynomial can be shared between nonces by an honest prover.
pub fn work<let L: u32>(domain: Field, seed: Field, epoch: Field, miner_commit: Field, nonce: Field) -> Field {
    let mut h = Poseidon2::hash([DOM_WORK, domain, seed, epoch, miner_commit, nonce], 6);
    for i in 0..L {
        h = Poseidon2::hash([h, i as Field], 2);
    }
    h
}
