// When epoch 0 opens. A profile with a notice period refuses a launch closer than that to the
// deployment, so the instance is on chain and inspectable before it accepts claims; a profile
// without one (tests, testnet) opens at once when launch_at is already in the past.
pub fn opened_at_for(launch_at: u64, now: u64, notice: u64) -> u64 {
    if notice > 0 {
        assert(launch_at >= now + notice, "launch_at is inside the notice period");
        launch_at
    } else if launch_at > now {
        launch_at
    } else {
        now
    }
}

#[test]
fn without_notice_a_past_launch_means_now_and_a_future_one_is_kept() {
    assert_eq(opened_at_for(0, 1000, 0), 1000);
    assert_eq(opened_at_for(999, 1000, 0), 1000);
    assert_eq(opened_at_for(5000, 1000, 0), 5000);
}

#[test]
fn with_notice_the_launch_is_kept_when_far_enough() {
    assert_eq(opened_at_for(1000 + 86400, 1000, 86400), 1000 + 86400);
    assert_eq(opened_at_for(1000 + 90000, 1000, 86400), 1000 + 90000);
}

#[test(should_fail_with = "launch_at is inside the notice period")]
fn with_notice_a_short_launch_is_refused() {
    let _ = opened_at_for(1000 + 86399, 1000, 86400);
}

#[test(should_fail_with = "launch_at is inside the notice period")]
fn with_notice_a_past_launch_is_refused() {
    let _ = opened_at_for(0, 1000, 86400);
}

// Whether the token may still be bound: at any time without a notice period (tests, testnet bind
// right after deploying), only before epoch 0 opens with one, so the announced token is the one
// every claim mints and an instance that opens unbound stays dead instead of rollable.
pub fn binding_allowed(now: u64, opened_at: u64, notice: u64) -> bool {
    (notice == 0) | (now < opened_at)
}

#[test]
fn binding_is_always_allowed_without_notice() {
    assert(binding_allowed(5000, 1000, 0));
    assert(binding_allowed(1000, 1000, 0));
}

#[test]
fn binding_must_precede_launch_with_notice() {
    assert(binding_allowed(999, 1000, 86400));
    assert(!binding_allowed(1000, 1000, 86400));
    assert(!binding_allowed(5000, 1000, 86400));
}
