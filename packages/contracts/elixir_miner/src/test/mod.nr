// TXE tests are plumbing-only: the simulator accepts any bytes as a proof (the first test pins
// that fact), so everything about proof validity is proved elsewhere. Each claim uses a distinct
// "proof" ground until its ticket wins, which also gives every claim its own nullifier.
mod vectors;

use crate::ElixirMiner;
use crate::params::{EXPECTED_EPOCH_SECONDS, N, REWARD, T_MAX};
use crate::retarget::next_target;
use crate::ticket::{low128, ticket_digest};
use aztec::{protocol::address::AztecAddress, test::helpers::test_environment::TestEnvironment};
use bb_proof_verification::RECURSIVE_PROOF_LENGTH;
use elixir_work_lib::DOM_SEED;
use poseidon::poseidon2::Poseidon2;
use token_contract::Token;

global INITIAL_TARGET: u128 = 1 << 122;

pub struct Setup {
    pub env: TestEnvironment,
    pub deployer: AztecAddress,
    pub miner: AztecAddress,
    pub token: AztecAddress,
}

// Token-less miner first (its address is then known), token with minter = miner, one bind.
unconstrained fn setup() -> Setup {
    let mut env = TestEnvironment::new();
    let deployer = env.create_light_account();
    let miner = env.deploy("ElixirMiner").with_public_initializer(
        deployer,
        ElixirMiner::interface().constructor(INITIAL_TARGET, 1234),
    );
    let token = env.deploy("@token_contract/Token").with_public_initializer(
        deployer,
        Token::interface().constructor_with_minter(
            "Elixir0000000000000000000000000",
            "ELX0000000000000000000000000000",
            18,
            miner,
            AztecAddress::zero(),
        ),
    );
    env.call_public(deployer, ElixirMiner::at(miner).bind_token(token));
    env.mine_block();
    Setup { env, deployer, miner, token }
}

// The k-th winning fixture: proof[0] = k' for the first k' ≥ k whose ticket is below the target.
unconstrained fn winning_proof(k: Field) -> ([Field; RECURSIVE_PROOF_LENGTH], Field) {
    let mut proof = [0; RECURSIVE_PROOF_LENGTH];
    let mut digest = 0;
    let mut found = false;
    for i in 0..4096 {
        if !found {
            proof[0] = k + i as Field;
            digest = ticket_digest(proof);
            found = low128(digest) < INITIAL_TARGET;
        }
    }
    assert(found, "no winning fixture found");
    (proof, digest)
}

unconstrained fn losing_proof(k: Field) -> ([Field; RECURSIVE_PROOF_LENGTH], Field) {
    let mut proof = [0; RECURSIVE_PROOF_LENGTH];
    let mut digest = 0;
    let mut found = false;
    for i in 0..4096 {
        if !found {
            proof[0] = k + i as Field;
            digest = ticket_digest(proof);
            found = low128(digest) >= INITIAL_TARGET;
        }
    }
    assert(found, "no losing fixture found");
    (proof, digest)
}

unconstrained fn claim(s: Setup, e: u64, k: Field) -> Field {
    let (proof, digest) = winning_proof(k);
    s.env.call_private(s.deployer, ElixirMiner::at(s.miner).claim(e, k, 0, 7, proof, s.deployer));
    s.env.mine_block();
    digest
}

unconstrained fn open_epoch(s: Setup) -> u64 {
    s.env.view_public(ElixirMiner::at(s.miner).open_epoch())
}

unconstrained fn target_of(s: Setup, e: u64) -> u128 {
    s.env.view_public(ElixirMiner::at(s.miner).epoch_params(e)).target
}

unconstrained fn expected_seed(s: Setup, closing_digest: Field) -> Field {
    let epoch0 = s.env.view_public(ElixirMiner::at(s.miner).epoch_params(0));
    let epoch1 = s.env.view_public(ElixirMiner::at(s.miner).epoch_params(1));
    Poseidon2::hash([DOM_SEED, epoch0.seed, 1, closing_digest, epoch1.opened_at as Field], 5)
}

#[test]
unconstrained fn txe_accepts_a_fabricated_proof() {
    // Documents why proof validity must be tested with real proving: this passes.
    let s = setup();
    let _ = claim(s, 0, 1000);
    assert_eq(s.env.view_public(ElixirMiner::at(s.miner).claims_in(0)), 1);
}

#[test]
unconstrained fn claim_mints_reward_privately() {
    let s = setup();
    let _ = claim(s, 0, 1000);
    let balance: u128 = s.env.execute_utility(Token::at(s.token).balance_of_private(s.deployer));
    assert_eq(balance, REWARD);
}

#[test(should_fail_with = "not deployer")]
unconstrained fn bind_token_rejects_non_deployer() {
    let mut env = TestEnvironment::new();
    let deployer = env.create_light_account();
    let stranger = env.create_light_account();
    let miner = env.deploy("ElixirMiner").with_public_initializer(
        deployer,
        ElixirMiner::interface().constructor(INITIAL_TARGET, 1),
    );
    env.call_public(stranger, ElixirMiner::at(miner).bind_token(stranger));
}

#[test(should_fail)]
unconstrained fn bind_token_is_one_shot() {
    let s = setup();
    s.env.call_public(s.deployer, ElixirMiner::at(s.miner).bind_token(s.token));
}

#[test(should_fail)]
unconstrained fn claim_before_binding_fails() {
    let mut env = TestEnvironment::new();
    let deployer = env.create_light_account();
    let miner = env.deploy("ElixirMiner").with_public_initializer(
        deployer,
        ElixirMiner::interface().constructor(INITIAL_TARGET, 1),
    );
    env.mine_block();
    let (proof, _) = winning_proof(1);
    env.call_private(deployer, ElixirMiner::at(miner).claim(0, 1, 0, 7, proof, deployer));
}

// The token refuses the miner as minter: the whole claim fails (mint is a private call inside the
// claim), so the count, the nullifier and the balance are untouched by construction.
#[test(should_fail_with = "caller is not minter")]
unconstrained fn claim_fails_when_the_bound_token_refuses_the_miner() {
    let mut env = TestEnvironment::new();
    let deployer = env.create_light_account();
    let miner = env.deploy("ElixirMiner").with_public_initializer(
        deployer,
        ElixirMiner::interface().constructor(INITIAL_TARGET, 1234),
    );
    let token = env.deploy("@token_contract/Token").with_public_initializer(
        deployer,
        Token::interface().constructor_with_minter(
            "Elixir0000000000000000000000000",
            "ELX0000000000000000000000000000",
            18,
            deployer,
            AztecAddress::zero(),
        ),
    );
    env.call_public(deployer, ElixirMiner::at(miner).bind_token(token));
    env.mine_block();
    let (proof, _) = winning_proof(1000);
    env.call_private(deployer, ElixirMiner::at(miner).claim(0, 1000, 0, 7, proof, deployer));
}

#[test(should_fail)]
unconstrained fn record_claim_is_only_self() {
    let s = setup();
    s.env.call_public(s.deployer, ElixirMiner::at(s.miner).record_claim(0, 1));
}

#[test(should_fail)]
unconstrained fn same_ticket_cannot_be_claimed_twice() {
    let s = setup();
    let _ = claim(s, 0, 1000);
    let _ = claim(s, 0, 1000);
}

#[test(should_fail_with = "ticket above target")]
unconstrained fn losing_ticket_is_rejected() {
    let s = setup();
    let (proof, _) = losing_proof(1);
    s.env.call_private(s.deployer, ElixirMiner::at(s.miner).claim(0, 1, 0, 7, proof, s.deployer));
}

#[test]
unconstrained fn nth_claim_closes_the_epoch_and_retargets_exactly() {
    let s = setup();
    // N claims, EXPECTED/2N seconds apart: a fast epoch, so the next target shrinks.
    let mut closing = 0;
    for i in 0..N {
        s.env.advance_next_block_timestamp_by(EXPECTED_EPOCH_SECONDS / (2 * N as u64));
        closing = claim(s, 0, (1000 * (i + 1)) as Field);
    }
    assert_eq(open_epoch(s), 1);
    assert_eq(s.env.view_public(ElixirMiner::at(s.miner).claims_in(0)), N);
    let epoch0 = s.env.view_public(ElixirMiner::at(s.miner).epoch_params(0));
    let epoch1 = s.env.view_public(ElixirMiner::at(s.miner).epoch_params(1));
    let actual = epoch1.opened_at - epoch0.opened_at;
    assert(actual < EXPECTED_EPOCH_SECONDS);
    assert_eq(epoch1.target, next_target(INITIAL_TARGET, actual));
    assert(epoch1.target < INITIAL_TARGET);
    assert_eq(epoch1.seed, expected_seed(s, closing));
}

#[test]
unconstrained fn late_count_close_is_capped_at_t_max() {
    let s = setup();
    for i in 0..N - 1 {
        let _ = claim(s, 0, (1000 * (i + 1)) as Field);
    }
    s.env.advance_next_block_timestamp_by(10 * T_MAX);
    let _ = claim(s, 0, (1000 * N) as Field);
    assert_eq(open_epoch(s), 1);
    assert_eq(target_of(s, 1), INITIAL_TARGET * 4);
}

#[test(should_fail_with = "epoch has not reached T_MAX")]
unconstrained fn roll_before_t_max_fails() {
    let s = setup();
    s.env.advance_next_block_timestamp_by(T_MAX - 1);
    s.env.call_public(s.deployer, ElixirMiner::at(s.miner).roll());
}

#[test]
unconstrained fn roll_after_t_max_eases_by_four_and_mixes_last_digest() {
    let s = setup();
    let last = claim(s, 0, 1000);
    s.env.advance_next_block_timestamp_by(T_MAX);
    s.env.call_public(s.deployer, ElixirMiner::at(s.miner).roll());
    assert_eq(open_epoch(s), 1);
    assert_eq(target_of(s, 1), INITIAL_TARGET * 4);
    let epoch1 = s.env.view_public(ElixirMiner::at(s.miner).epoch_params(1));
    assert_eq(epoch1.seed, expected_seed(s, last));
}

// The TXE applies public writes at once, so a claim after roll() in the same block already fails
// its historical read. The real race — private anchored before the roll, public after it — ends
// in record_claim's "stale claim" and is only reproducible on a network (miner-core's burst test).
#[test(should_fail_with = "epoch is not open")]
unconstrained fn claim_after_roll_in_the_same_block_is_refused_at_simulation() {
    let s = setup();
    s.env.advance_next_block_timestamp_by(T_MAX);
    s.env.call_public(s.deployer, ElixirMiner::at(s.miner).roll());
    let (proof, _) = winning_proof(1000);
    s.env.call_private(s.deployer, ElixirMiner::at(s.miner).claim(0, 1000, 0, 7, proof, s.deployer));
}

#[test(should_fail)]
unconstrained fn claim_against_a_closed_epoch_fails() {
    let s = setup();
    s.env.advance_next_block_timestamp_by(T_MAX);
    s.env.call_public(s.deployer, ElixirMiner::at(s.miner).roll());
    s.env.mine_block();
    let _ = claim(s, 0, 1000);
}

#[test]
unconstrained fn constants_match_the_profile() {
    let s = setup();
    let c = s.env.view_public(ElixirMiner::at(s.miner).constants());
    assert_eq(c, [N as Field, EXPECTED_EPOCH_SECONDS as Field, T_MAX as Field, REWARD as Field]);
}
