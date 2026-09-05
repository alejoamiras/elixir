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
    let (q, r) = unsafe { div_rem_hint(target, actual) };
    constrain_quotient(target, actual, q, r);
    clamp(q, lower_bound(target), upper_bound(target))
}

// Pins (q, r) to ⌊target·actual / EXPECTED⌋ and the remainder. q ≤ 2^130 − 1 and r ≤ EXPECTED − 1
// keep q·EXPECTED + r ≤ 2^130·EXPECTED − 1 < 2^147, as is target·actual, so the field equality
// cannot be satisfied by a wrapped pair.
pub fn constrain_quotient(target: u128, actual: u64, q: Field, r: Field) {
    q.assert_max_bit_size::<130>();
    r.assert_max_bit_size::<64>();
    assert((r as u64) < EXPECTED_EPOCH_SECONDS, "remainder not reduced");
    let product: Field = (target as Field) * (actual as Field);
    assert(q * (EXPECTED_EPOCH_SECONDS as Field) + r == product, "quotient hint is wrong");
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
pub fn lower_bound(target: u128) -> u128 {
    target / 4 + (if target % 4 != 0 { 1 } else { 0 })
}

// 4 × target, saturating at 2^128 − 1.
pub fn upper_bound(target: u128) -> u128 {
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

// Reference quotient computed the same limb-wise way in test code (no u256 available).
fn reference(t: u128, actual: u64) -> u128 {
    let d = EXPECTED_EPOCH_SECONDS as u128;
    (t / d) * (actual as u128) + ((t % d) * (actual as u128)) / d
}

#[test]
fn exact_at_launch_targets_with_odd_durations() {
    let actual = EXPECTED_EPOCH_SECONDS + 7;
    let t: u128 = (1 << 118) + 12345;
    assert_eq(next_target(t, actual), reference(t, actual));
    // 2^126 × 307 exceeds u128: the product only exists in the field.
    let t2: u128 = (1 << 126) + 999;
    assert_eq(next_target(t2, actual), reference(t2, actual));
    assert_eq(next_target(t2, EXPECTED_EPOCH_SECONDS), t2);
}

#[test]
fn bound_helpers_at_extrema() {
    assert_eq(lower_bound(1), 1);
    assert_eq(lower_bound(2), 1);
    assert_eq(lower_bound(3), 1);
    assert_eq(lower_bound(4), 1);
    assert_eq(lower_bound(5), 2);
    assert_eq(lower_bound(U128_MAX), U128_MAX / 4 + 1);
    assert_eq(upper_bound(1 << 126), U128_MAX);
    assert_eq(upper_bound((1 << 126) - 1), ((1 << 126) - 1) * 4);
    assert_eq(next_target(1, 1), 1);
}

#[test(should_fail_with = "actual duration above T_MAX")]
fn rejects_durations_above_t_max() {
    let _ = next_target(1 << 122, T_MAX + 1);
}

#[test(should_fail_with = "quotient hint is wrong")]
fn rejects_a_quotient_off_by_one() {
    let t: u128 = 1 << 122;
    let q = (t as Field) - 1; // true quotient at actual == EXPECTED is t
    constrain_quotient(t, EXPECTED_EPOCH_SECONDS, q, 0);
}

#[test(should_fail_with = "remainder not reduced")]
fn rejects_an_unreduced_remainder() {
    let t: u128 = 1 << 122;
    // q·d + r == product also holds for q − 1, r + d: the range check on r rejects it.
    constrain_quotient(t, EXPECTED_EPOCH_SECONDS, (t as Field) - 1, EXPECTED_EPOCH_SECONDS as Field);
}

#[test(should_fail)]
fn rejects_a_wrapped_quotient() {
    // q = −1 (mod p) satisfies q·d + r == product with r = product + d, a wrapped pair that only
    // the range checks reject: q has 254 bits, r has far more than 64.
    let t: u128 = 1 << 122;
    let d = EXPECTED_EPOCH_SECONDS as Field;
    let product = (t as Field) * d;
    constrain_quotient(t, EXPECTED_EPOCH_SECONDS, 0 - 1, product + d);
}
