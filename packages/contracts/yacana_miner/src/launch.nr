// The launch lottery, RANDAO-style. Everything the AVM exposes (addresses, slot timestamps) is
// choosable or predictable well before the launch, so a seed derived from it alone can be
// pre-mined by whoever picks it throughout the notice period. Instead: anyone commits a hash
// before launch_at, reveals the preimage during the window after it, and seed_0 mixes every
// reveal. A participant keeps a one-bit option per commitment (reveal or withhold), but each
// candidate branch costs its own pre-mining inside the window, so the head start is bounded by
// the window instead of the notice, provided at least one honest reveal lands late and
// uncensored; with none, the seed only depends on values its author knew all along.
use yacana_work_lib::{DOM_LAUNCH, DOM_SEED};
use poseidon::poseidon2::Poseidon2;

// The earliest time the lottery may start. A profile with a notice period refuses a launch closer
// than that to the deployment, so the instance is on chain and inspectable before it can open;
// a profile without one (tests, testnet) may launch at once when launch_at is in the past.
pub fn launch_time(launch_at: u64, now: u64, notice: u64) -> u64 {
    if notice > 0 {
        assert(launch_at >= now + notice, "launch_at is inside the notice period");
        launch_at
    } else if launch_at > now {
        launch_at
    } else {
        now
    }
}

// Whether the token may still be bound: at any time without a notice period, only before the
// launch time with one, so the deployer cannot stall the lottery by binding late.
pub fn binding_allowed(now: u64, launch_at: u64, notice: u64) -> bool {
    (notice == 0) | (now < launch_at)
}

pub fn commit_allowed(now: u64, launch_at: u64) -> bool {
    now < launch_at
}

pub fn reveal_allowed(now: u64, launch_at: u64, window: u64) -> bool {
    (now >= launch_at) & (now < launch_at + window)
}

pub fn open_allowed(now: u64, launch_at: u64, window: u64) -> bool {
    now >= launch_at + window
}

global COMMIT_TAG: Field = 1;
global REVEAL_TAG: Field = 2;

// Bound to the deployment and the committing address, so an observed commitment cannot be
// copied into other addresses and revealed as extra branches once its preimage is public.
pub fn commitment_of(deployment: Field, committer: Field, preimage: Field) -> Field {
    Poseidon2::hash([DOM_LAUNCH, COMMIT_TAG, deployment, committer, preimage], 5)
}

// What a reveal adds to the mix: unknowable from the public commitment until the preimage is
// out, so the sum of commitments (public before launch_at) says nothing about the seed.
pub fn contribution_of(deployment: Field, committer: Field, preimage: Field) -> Field {
    Poseidon2::hash([DOM_LAUNCH, REVEAL_TAG, deployment, committer, preimage], 5)
}

// Commutative: reveal order changes nothing, so k commitments give 2^k branches, not k! orders.
pub fn mix_reveal(mix: Field, contribution: Field) -> Field {
    mix + contribution
}

pub fn genesis_epoch_seed(genesis_seed: Field, mix: Field, now: u64) -> Field {
    Poseidon2::hash([DOM_SEED, genesis_seed, 0, mix, now as Field], 5)
}

#[test]
fn without_notice_a_past_launch_means_now_and_a_future_one_is_kept() {
    assert_eq(launch_time(0, 1000, 0), 1000);
    assert_eq(launch_time(999, 1000, 0), 1000);
    assert_eq(launch_time(5000, 1000, 0), 5000);
}

#[test]
fn with_notice_the_launch_is_kept_when_far_enough() {
    assert_eq(launch_time(1000 + 86400, 1000, 86400), 1000 + 86400);
    assert_eq(launch_time(1000 + 90000, 1000, 86400), 1000 + 90000);
}

#[test(should_fail_with = "launch_at is inside the notice period")]
fn with_notice_a_short_launch_is_refused() {
    let _ = launch_time(1000 + 86399, 1000, 86400);
}

#[test(should_fail_with = "launch_at is inside the notice period")]
fn with_notice_a_past_launch_is_refused() {
    let _ = launch_time(0, 1000, 86400);
}

#[test]
fn binding_is_always_allowed_without_notice_and_only_before_launch_with_one() {
    assert(binding_allowed(5000, 1000, 0));
    assert(binding_allowed(999, 1000, 86400));
    assert(!binding_allowed(1000, 1000, 86400));
}

#[test]
fn lottery_phases_are_contiguous_and_exclusive() {
    let (launch_at, window) = (1000, 600);
    assert(commit_allowed(999, launch_at));
    assert(!commit_allowed(1000, launch_at));
    assert(!reveal_allowed(999, launch_at, window));
    assert(reveal_allowed(1000, launch_at, window));
    assert(reveal_allowed(1599, launch_at, window));
    assert(!reveal_allowed(1600, launch_at, window));
    assert(!open_allowed(1599, launch_at, window));
    assert(open_allowed(1600, launch_at, window));
    // Without a window (tests, testnet) nothing can be revealed and the launch opens at launch_at.
    assert(!reveal_allowed(1000, launch_at, 0));
    assert(open_allowed(1000, launch_at, 0));
}

#[test]
fn every_reveal_changes_the_seed_and_order_does_not() {
    let none = genesis_epoch_seed(7, 0, 1000);
    let ca = contribution_of(1, 0xa, 11);
    let cb = contribution_of(1, 0xb, 22);
    let a = mix_reveal(0, ca);
    let ab = mix_reveal(a, cb);
    let ba = mix_reveal(mix_reveal(0, cb), ca);
    assert(genesis_epoch_seed(7, a, 1000) != none);
    assert(genesis_epoch_seed(7, ab, 1000) != genesis_epoch_seed(7, a, 1000));
    assert_eq(ab, ba);
    assert(genesis_epoch_seed(7, ab, 1000) != genesis_epoch_seed(7, ab, 1001));
    // The same preimage commits differently per deployment and per committer, and what it adds
    // to the mix is not its (public) commitment.
    assert(commitment_of(1, 0xa, 11) != commitment_of(2, 0xa, 11));
    assert(commitment_of(1, 0xa, 11) != commitment_of(1, 0xb, 11));
    assert(contribution_of(1, 0xa, 11) != commitment_of(1, 0xa, 11));
}
