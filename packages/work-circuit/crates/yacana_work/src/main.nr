// Public inputs, in this fixed order: [domain, seed, epoch, miner_commit, nonce, out].
// `domain` binds the proof to one deployment (chain id, miner contract, puzzle version).
mod params;

use params::CHAIN_LEN;

fn main(domain: pub Field, seed: pub Field, epoch: pub Field, miner_commit: pub Field, nonce: pub Field) -> pub Field {
    yacana_work_lib::work::<CHAIN_LEN>(domain, seed, epoch, miner_commit, nonce)
}
