// Invariants: at most N accepted claims and N × REWARD minted per epoch; the target moves by at
// most ×4 or ÷4 per close; no privileged call remains once bind_token has run.
mod params;
mod retarget;
mod test;
mod ticket;
mod vk;

use aztec::macros::aztec;

#[aztec]
pub contract ElixirMiner {
    use aztec::{
        history::storage::public_storage_historical_read,
        macros::{functions::{external, initializer, internal, only_self, view}, storage::storage},
        protocol::{address::AztecAddress, traits::{Deserialize, Packable, Serialize, ToField}},
        state_vars::{Map, PublicImmutable, PublicMutable, StateVariable},
    };
    use bb_proof_verification::{RECURSIVE_PROOF_LENGTH, verify_honk_proof_non_zk};
    use elixir_work_lib::{DOM_DEPLOY, DOM_NULL, DOM_SECRET, DOM_SEED};
    use poseidon::poseidon2::Poseidon2;
    use std::meta::derive;
    use token_contract::Token;
    use crate::params::{EXPECTED_EPOCH_SECONDS, N, REWARD, T_MAX, VERSION};
    use crate::retarget::next_target;
    use crate::ticket::{low128, ticket_digest};
    use crate::vk::{W_VK, W_VK_HASH};

    global NUM_PUBLIC_INPUTS: u32 = 6;

    #[derive(Deserialize, Eq, Packable, Serialize)]
    pub struct EpochParams {
        pub target: u128,
        pub seed: Field,
        pub opened_at: u64,
    }

    #[storage]
    struct Storage<Context> {
        deployer: PublicImmutable<AztecAddress, Context>,
        token: PublicImmutable<AztecAddress, Context>,
        epochs: Map<u64, PublicImmutable<EpochParams, Context>, Context>,
        claims: Map<u64, PublicMutable<u32, Context>, Context>,
        last_digest: Map<u64, PublicMutable<Field, Context>, Context>,
        open_epoch: PublicMutable<u64, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(initial_target: u128, genesis_seed: Field) {
        assert(initial_target > 0, "target must be positive");
        self.storage.deployer.initialize(self.msg_sender());
        self.storage.epochs.at(0).initialize(
            EpochParams { target: initial_target, seed: genesis_seed, opened_at: self.context.timestamp() },
        );
        self.storage.open_epoch.write(0);
    }

    // The only privileged call, usable once: PublicImmutable's initialization nullifier makes a
    // second call revert, and nothing reads `deployer` afterwards.
    #[external("public")]
    fn bind_token(token: AztecAddress) {
        assert(self.msg_sender() == self.storage.deployer.read(), "not deployer");
        self.storage.token.initialize(token);
    }

    #[external("private")]
    fn claim(
        e: u64,
        nonce: Field,
        out: Field,
        secret: Field,
        proof: [Field; RECURSIVE_PROOF_LENGTH],
        recipient: AztecAddress,
    ) {
        // A claim against a closed epoch fails here, at simulation, before any proving.
        let open = public_storage_historical_read(
            self.context.get_anchor_block_header(),
            self.storage.open_epoch.get_storage_slot(),
            self.context.this_address(),
        );
        assert(open == e as Field, "epoch is not open");
        let params = self.storage.epochs.at(e).read();
        let token = self.storage.token.read();
        let domain = Poseidon2::hash(
            [DOM_DEPLOY, self.context.chain_id(), self.context.this_address().to_field(), VERSION],
            4,
        );
        let commit = Poseidon2::hash([DOM_SECRET, secret], 2);
        verify_honk_proof_non_zk(W_VK, proof, [domain, params.seed, e as Field, commit, nonce, out], W_VK_HASH);
        let digest = ticket_digest(proof);
        assert(low128(digest) < params.target, "ticket above target");
        self.context.push_nullifier_unsafe(Poseidon2::hash([DOM_NULL, digest], 2));
        // Enqueued before the mint: a stale claim reverts before any mint work runs.
        self.enqueue_self.record_claim(e, digest);
        self.call(Token::at(token).mint_to_private(recipient, REWARD));
    }

    #[external("public")]
    #[only_self]
    fn record_claim(e: u64, digest: Field) {
        assert(e == self.storage.open_epoch.read(), "stale claim");
        let count = self.storage.claims.at(e).read() + 1;
        assert(count <= N, "epoch full");
        self.storage.claims.at(e).write(count);
        self.storage.last_digest.at(e).write(digest);
        if count == N {
            // Nobody may have called roll(), so the Nth claim can land arbitrarily late: cap it.
            let elapsed = self.context.timestamp() - self.storage.epochs.at(e).read().opened_at;
            let actual = if elapsed > T_MAX { T_MAX } else { elapsed };
            self.internal.close(e, actual, digest);
        }
    }

    // Escape hatch for hashrate collapse: anyone may close an epoch that stayed open for T_MAX.
    // The retarget is exactly ×4, and every input of the next seed is public in advance.
    #[external("public")]
    fn roll() {
        let e = self.storage.open_epoch.read();
        let opened_at = self.storage.epochs.at(e).read().opened_at;
        assert(self.context.timestamp() - opened_at >= T_MAX, "epoch has not reached T_MAX");
        self.internal.close(e, T_MAX, self.storage.last_digest.at(e).read());
    }

    #[internal("public")]
    fn close(e: u64, actual: u64, closing_digest: Field) {
        let params = self.storage.epochs.at(e).read();
        let now = self.context.timestamp();
        let next = e + 1;
        let seed = Poseidon2::hash([DOM_SEED, params.seed, next as Field, closing_digest, now as Field], 5);
        self.storage.epochs.at(next).initialize(
            EpochParams { target: next_target(params.target, actual), seed, opened_at: now },
        );
        self.storage.open_epoch.write(next);
    }

    #[external("public")]
    #[view]
    fn epoch_params(e: u64) -> EpochParams {
        self.storage.epochs.at(e).read()
    }

    #[external("public")]
    #[view]
    fn open_epoch() -> u64 {
        self.storage.open_epoch.read()
    }

    #[external("public")]
    #[view]
    fn claims_in(e: u64) -> u32 {
        self.storage.claims.at(e).read()
    }

    #[external("public")]
    #[view]
    fn constants() -> [Field; 4] {
        [N as Field, EXPECTED_EPOCH_SECONDS as Field, T_MAX as Field, REWARD as Field]
    }
}
