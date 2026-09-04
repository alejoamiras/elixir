// Invariants: at most N accepted claims and N × REWARD minted per epoch; the target moves by at
// most ×4 or ÷4 per close; epoch 0 exists only once launch() ran, after the announced launch
// time and its reveal window; no privileged call remains once bind_token has run.
mod launch;
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
    use crate::launch::{
        binding_allowed, commit_allowed, commitment_of, contribution_of, genesis_epoch_seed, launch_time,
        mix_reveal, open_allowed, reveal_allowed,
    };
    use crate::params::{
        CLAIM_TTL_SECONDS, EXPECTED_EPOCH_SECONDS, LAUNCH_NOTICE_SECONDS, N, REVEAL_WINDOW_SECONDS, REWARD,
        T_MAX, VERSION,
    };
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

    #[derive(Deserialize, Eq, Packable, Serialize)]
    pub struct Genesis {
        pub target: u128,
        pub seed: Field,
        /** Earliest time launch() may open epoch 0. */
        pub launch_at: u64,
    }

    #[storage]
    struct Storage<Context> {
        deployer: PublicImmutable<AztecAddress, Context>,
        token: PublicImmutable<AztecAddress, Context>,
        genesis: PublicImmutable<Genesis, Context>,
        // Launch lottery (launch.nr): one commitment per address, the running mix of reveals.
        launch_commits: Map<AztecAddress, PublicMutable<Field, Context>, Context>,
        launch_mix: PublicMutable<Field, Context>,
        launch_reveals: PublicMutable<u32, Context>,
        epochs: Map<u64, PublicImmutable<EpochParams, Context>, Context>,
        claims: Map<u64, PublicMutable<u32, Context>, Context>,
        last_digest: Map<u64, PublicMutable<Field, Context>, Context>,
        open_epoch: PublicMutable<u64, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(initial_target: u128, genesis_seed: Field, launch_at: u64) {
        assert(initial_target > 0, "target must be positive");
        self.storage.deployer.initialize(self.msg_sender());
        // Epoch 0 does not exist yet: launch() opens it at or after launch_at (see launch.nr for
        // the notice rule), so the deployment can be announced before anyone can mine on it.
        let launch_at = launch_time(launch_at, self.context.timestamp(), LAUNCH_NOTICE_SECONDS);
        self.storage.genesis.initialize(Genesis { target: initial_target, seed: genesis_seed, launch_at });
        self.storage.open_epoch.write(0);
    }

    // The only privileged call, usable once: PublicImmutable's initialization nullifier makes a
    // second call revert, and nothing reads `deployer` afterwards.
    #[external("public")]
    fn bind_token(token: AztecAddress) {
        assert(self.msg_sender() == self.storage.deployer.read(), "not deployer");
        assert(!token.is_zero(), "token is zero");
        let minter = self.view(Token::at(token).get_minter());
        assert(minter == self.context.this_address(), "token minter is not this miner");
        // Only the deployer can bind, so a late binding could stall the lottery while it mines.
        let launch_at = self.storage.genesis.read().launch_at;
        assert(
            binding_allowed(self.context.timestamp(), launch_at, LAUNCH_NOTICE_SECONDS),
            "token must be bound before launch",
        );
        self.storage.token.initialize(token);
    }

    // Launch lottery, phase 1: anyone commits Poseidon2(DOM_LAUNCH, this, sender, preimage) before launch_at.
    #[external("public")]
    fn commit_launch(commitment: Field) {
        assert(commit_allowed(self.context.timestamp(), self.storage.genesis.read().launch_at), "commit phase is over");
        assert(commitment != 0, "empty commitment");
        let slot = self.storage.launch_commits.at(self.msg_sender());
        assert(slot.read() == 0, "already committed");
        slot.write(commitment);
    }

    // Phase 2: reveal during the window after launch_at; every reveal folds into the mix.
    #[external("public")]
    fn reveal_launch(preimage: Field) {
        let launch_at = self.storage.genesis.read().launch_at;
        assert(reveal_allowed(self.context.timestamp(), launch_at, REVEAL_WINDOW_SECONDS), "not in the reveal window");
        let sender = self.msg_sender();
        let slot = self.storage.launch_commits.at(sender);
        let this = self.context.this_address().to_field();
        assert(slot.read() == commitment_of(this, sender.to_field(), preimage), "preimage does not match the commitment");
        slot.write(0);
        let contribution = contribution_of(this, sender.to_field(), preimage);
        self.storage.launch_mix.write(mix_reveal(self.storage.launch_mix.read(), contribution));
        self.storage.launch_reveals.write(self.storage.launch_reveals.read() + 1);
    }

    // Phase 3: anyone opens epoch 0 once the reveal window closed and the token is bound. seed_0
    // mixes the genesis seed, every reveal and the opening block's timestamp. PublicImmutable's
    // initialization nullifier makes a second launch revert.
    #[external("public")]
    fn launch() {
        let g = self.storage.genesis.read();
        let now = self.context.timestamp();
        assert(open_allowed(now, g.launch_at, REVEAL_WINDOW_SECONDS), "reveal window not over");
        assert(self.storage.token.is_initialized(), "token not bound");
        let seed = genesis_epoch_seed(g.seed, self.storage.launch_mix.read(), now);
        self.storage.epochs.at(0).initialize(EpochParams { target: g.target, seed, opened_at: now });
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
        let anchor = self.context.get_anchor_block_header();
        let open = public_storage_historical_read(
            anchor,
            self.storage.open_epoch.get_storage_slot(),
            self.context.this_address(),
        );
        assert(open == e as Field, "epoch is not open");
        // The tx would otherwise stay valid for MAX_TX_LIFETIME after its anchor: cheap work against a
        // long-closed, easier epoch could then be submitted to revert at the fee payer's expense. An
        // expired claim is dropped instead; the PXE frees its pending delivery index on the next sync.
        self.context.set_expiration_timestamp(anchor.timestamp() + CLAIM_TTL_SECONDS);
        // Before launch() epoch 0 is uninitialized and this read fails at simulation.
        let params = self.storage.epochs.at(e).read();
        let token = self.storage.token.read();
        // The rollup version separates forks that would otherwise share chain id, address and state.
        let domain = Poseidon2::hash(
            [
                DOM_DEPLOY,
                self.context.chain_id(),
                self.context.version(),
                self.context.this_address().to_field(),
                VERSION,
            ],
            5,
        );
        // The recipient sits inside the commitment, so a leaked (proof, secret) pays nobody else.
        let commit = Poseidon2::hash([DOM_SECRET, secret, recipient.to_field()], 3);
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
        assert(self.storage.epochs.at(e).is_initialized(), "not launched");
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

    // Lottery state: the running mix of reveals and how many landed.
    #[external("public")]
    #[view]
    fn launch_lottery() -> (Field, u32) {
        (self.storage.launch_mix.read(), self.storage.launch_reveals.read())
    }

    // The announced genesis: target, seed input and earliest launch time.
    #[external("public")]
    #[view]
    fn genesis() -> Genesis {
        self.storage.genesis.read()
    }

    // Which token this deployment mints, for checking against the announcement.
    #[external("public")]
    #[view]
    fn bound_token() -> AztecAddress {
        self.storage.token.read()
    }

    // The pinned work-circuit VK, for checking a deployment against its announcement.
    #[external("public")]
    #[view]
    fn work_vk_hash() -> Field {
        W_VK_HASH
    }

    #[external("public")]
    #[view]
    fn constants() -> [Field; 5] {
        [
            N as Field,
            EXPECTED_EPOCH_SECONDS as Field,
            T_MAX as Field,
            REWARD as Field,
            CLAIM_TTL_SECONDS as Field,
        ]
    }
}
