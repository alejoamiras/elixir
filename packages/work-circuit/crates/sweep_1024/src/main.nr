fn main(domain: pub Field, seed: pub Field, epoch: pub Field, miner_commit: pub Field, nonce: pub Field) -> pub Field {
    yacana_work_lib::work::<1024>(domain, seed, epoch, miner_commit, nonce)
}
