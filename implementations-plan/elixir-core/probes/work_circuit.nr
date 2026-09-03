use poseidon::poseidon2::Poseidon2;
global CHAIN_LEN: u32 = 2048;
fn main(seed: pub Field, epoch: pub Field, miner_commit: pub Field, nonce: pub Field) -> pub Field {
    let mut h = Poseidon2::hash([424242, seed, epoch, miner_commit, nonce], 5);
    for i in 0..CHAIN_LEN { h = Poseidon2::hash([h, i as Field], 2); }
    h
}
