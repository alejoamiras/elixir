// The bridge side of the miner: what a crossing needs beyond the message contents in
// yacana_bridge_hashes. A version's schedule continues on the next one, so a continuation starts
// at the epoch after its source's last one, with a seed anyone can derive from the source's public
// storage — mixed with the actual opening time so the head start a public seed gives is one epoch's
// reward per candidate slot, not the whole notice period.
use poseidon::poseidon2::Poseidon2;
use yacana_work_lib::DOM_SEED;

/// The first seed of a continuation: the source's last seed chained once more, then opened like a
/// genesis (launch.nr's genesis_epoch_seed with no lottery mix).
pub fn continuation_seed(source_last_seed: Field, first_epoch: u64, now: u64) -> Field {
    let chained = Poseidon2::hash([DOM_SEED, source_last_seed, first_epoch as Field], 3);
    Poseidon2::hash([DOM_SEED, chained, 0, 0, now as Field], 5)
}

#[test]
fn continuation_seed_depends_on_every_input() {
    let a = continuation_seed(1, 7, 100);
    assert(a != continuation_seed(2, 7, 100));
    assert(a != continuation_seed(1, 8, 100));
    assert(a != continuation_seed(1, 7, 101));
}
