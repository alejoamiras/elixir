use poseidon::poseidon2::Poseidon2;

// Domain separators come from yacana.params.json through the codegen (domains.nr), the same
// source miner-core reads; the chain steps inside the work do not need one.
mod domains;
pub use domains::{DOM_DEPLOY, DOM_LAUNCH, DOM_NULL, DOM_SECRET, DOM_SEED, DOM_TICKET, DOM_WORK};

// The work: a Poseidon2 chain of length L seeded by every public input. The nonce is absorbed
// first so no wire polynomial can be shared between nonces by an honest prover.
pub fn work<let L: u32>(domain: Field, seed: Field, epoch: Field, miner_commit: Field, nonce: Field) -> Field {
    let mut h = Poseidon2::hash([DOM_WORK, domain, seed, epoch, miner_commit, nonce], 6);
    for i in 0..L {
        h = Poseidon2::hash([h, i as Field], 2);
    }
    h
}
