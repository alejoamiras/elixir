// Public inputs, in this fixed order: [domain, seed, epoch, miner_commit, nonce, out].
// `domain` binds the proof to one deployment (chain id, miner contract, puzzle version).
global CHAIN_LEN: u32 = 2048;

fn main(domain: pub Field, seed: pub Field, epoch: pub Field, miner_commit: pub Field, nonce: pub Field) -> pub Field {
    elixir_work_lib::work::<CHAIN_LEN>(domain, seed, epoch, miner_commit, nonce)
}
