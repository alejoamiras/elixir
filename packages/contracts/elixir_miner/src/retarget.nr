// Bitcoin-style retarget in exact integer arithmetic, safe for any target < 2^128 and any
// actual ≤ T_MAX: the product target × actual (< 2^147) never wraps in the field, the quotient
// and remainder arrive as unconstrained hints and are pinned by range checks plus one field
// equality, so (q, r) is the unique Euclidean pair. Result clamped to [⌈target/4⌉, 4·target]
// (saturating at 2^128 − 1) and never 0.
use crate::params::{EXPECTED_EPOCH_SECONDS, T_MAX};

global U128_MAX: u128 = 0xffffffffffffffffffffffffffffffff;

pub fn next_target(target: u128, actual: u64) -> u128 {
    std::static_assert(T_MAX == 4 * EXPECTED_EPOCH_SECONDS, "T_MAX must be 4 x EXPECTED_EPOCH_SECONDS");
    std::static_assert(EXPECTED_EPOCH_SECONDS > 0, "EXPECTED_EPOCH_SECONDS must be positive");
    std::static_assert(EXPECTED_EPOCH_SECONDS < 131072, "EXPECTED_EPOCH_SECONDS must be below 2^17");
    assert(actual <= T_MAX, "actual duration above T_MAX");
    let product: Field = (target as Field) * (actual as Field);
    let (q, r) = unsafe { div_rem_hint(target, actual) };
    q.assert_max_bit_size::<130>();
    r.assert_max_bit_size::<64>();
    assert((r as u64) < EXPECTED_EPOCH_SECONDS, "remainder not reduced");
    assert(q * (EXPECTED_EPOCH_SECONDS as Field) + r == product, "quotient hint is wrong");
    clamp(q, floor_bound(target), ceil_bound(target))
}

// Quotient and remainder of target × actual by EXPECTED, computed without overflowing u128:
// target = a·d + b  ⇒  target·actual = (a·actual)·d + b·actual, with b·actual < 4·d² < 2^36.
unconstrained fn div_rem_hint(target: u128, actual: u64) -> (Field, Field) {
    let d = EXPECTED_EPOCH_SECONDS as u128;
    let a = target / d;
    let b = target % d;
    let ba = b * (actual as u128);
    let q = (a as Field) * (actual as Field) + ((ba / d) as Field);
    (q, (ba % d) as Field)
}

// ⌈target / 4⌉ without overflow.
pub fn floor_bound(target: u128) -> u128 {
    target / 4 + (if target % 4 != 0 { 1 } else { 0 })
}

// 4 × target, saturating at 2^128 − 1.
pub fn ceil_bound(target: u128) -> u128 {
    if target > U128_MAX / 4 { U128_MAX } else { target * 4 }
}

// raw < 2^130 is compared as a field element; lo and hi fit u128, so the clamped value does too.
fn clamp(raw: Field, lo: u128, hi: u128) -> u128 {
    let below = raw.lt(lo as Field);
    let above = (hi as Field).lt(raw);
    let clamped = if below { lo } else if above { hi } else { raw as u128 };
    if clamped == 0 { 1 } else { clamped }
}

#[test]
fn keeps_target_when_on_schedule() {
    let t: u128 = 1 << 122;
    assert_eq(next_target(t, EXPECTED_EPOCH_SECONDS), t);
}

#[test]
fn halves_when_twice_as_fast_and_clamps_at_quarter() {
    let t: u128 = 1 << 122;
    assert_eq(next_target(t, EXPECTED_EPOCH_SECONDS / 2), t / 2);
    assert_eq(next_target(t, 1), t / 4);
}

#[test]
fn quadruples_at_t_max_and_saturates() {
    let t: u128 = 1 << 122;
    assert_eq(next_target(t, T_MAX), t * 4);
    assert_eq(next_target(U128_MAX - 5, T_MAX), U128_MAX);
    assert_eq(next_target(1 << 127, T_MAX), U128_MAX);
}

#[test]
fn exact_at_launch_targets_with_odd_durations() {
    // target × actual / EXPECTED for targets in 2^118..2^126 and a duration that does not divide.
    let actual = EXPECTED_EPOCH_SECONDS + 7;
    let t: u128 = (1 << 118) + 12345;
    let expected = (t / (EXPECTED_EPOCH_SECONDS as u128)) * (actual as u128)
        + ((t % (EXPECTED_EPOCH_SECONDS as u128)) * (actual as u128)) / (EXPECTED_EPOCH_SECONDS as u128);
    assert_eq(next_target(t, actual), expected);
    let t2: u128 = (1 << 126) - 1;
    assert_eq(next_target(t2, EXPECTED_EPOCH_SECONDS), t2);
}

#[test]
fn bound_helpers_at_extrema() {
    assert_eq(floor_bound(1), 1);
    assert_eq(floor_bound(2), 1);
    assert_eq(floor_bound(3), 1);
    assert_eq(floor_bound(4), 1);
    assert_eq(floor_bound(5), 2);
    assert_eq(floor_bound(U128_MAX), U128_MAX / 4 + 1);
    assert_eq(ceil_bound(1 << 126), U128_MAX);
    assert_eq(ceil_bound((1 << 126) - 1), ((1 << 126) - 1) * 4);
    assert_eq(next_target(1, 1), 1);
}

#[test(should_fail_with = "actual duration above T_MAX")]
fn rejects_durations_above_t_max() {
    let _ = next_target(1 << 122, T_MAX + 1);
}
