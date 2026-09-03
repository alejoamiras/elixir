// Feasibility spike: the full claim shape of the miner (verifier inline, both historical reads,
// nullifier, real token mint with its public finalizer, record_claim enqueue) plus a variant that
// verifies the ticket in a separate only_self circuit. Epoch closing and retargeting are not here.
mod ticket;
mod vk;

use aztec::macros::aztec;

#[aztec]
pub contract ElixirSpike {
    use aztec::{
        history::storage::public_storage_historical_read,
        macros::{functions::{external, initializer, internal, only_self, view}, storage::storage},
        protocol::{address::AztecAddress, traits::{Deserialize, Packable, Serialize, ToField}},
        state_vars::{Map, PublicImmutable, PublicMutable, StateVariable},
    };
    use bb_proof_verification::{RECURSIVE_PROOF_LENGTH, verify_honk_proof_non_zk};
    use elixir_work_lib::{DOM_DEPLOY, DOM_NULL, DOM_SECRET};
    use poseidon::poseidon2::Poseidon2;
    use std::meta::derive;
    use token_contract::Token;
    use crate::ticket::{low128, ticket_digest};
    use crate::vk::{W_VK, W_VK_HASH};

    global VERSION: Field = 1;
    global N: u32 = 24;
    global REWARD: u128 = 4_000_000_000_000_000_000; // 4 ELX, 18 decimals
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
        open_epoch: PublicMutable<u64, Context>,
    }

    #[external("public")]
    #[initializer]
    fn constructor(initial_target: u128, genesis_seed: Field) {
        self.storage.deployer.initialize(self.msg_sender());
        self.storage.epochs.at(0).initialize(
            EpochParams { target: initial_target, seed: genesis_seed, opened_at: self.context.timestamp() },
        );
        self.storage.open_epoch.write(0);
    }

    // One-shot: PublicImmutable's initialization nullifier makes a second call revert.
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
        let (params, token) = self.internal.read_epoch_and_token(e);
        let public_inputs = self.internal.public_inputs(e, nonce, out, secret, params.seed);
        verify_honk_proof_non_zk(W_VK, proof, public_inputs, W_VK_HASH);
        let digest = ticket_digest(proof);
        self.internal.settle(e, digest, params.target, token, recipient);
    }

    // Same claim with the verification in its own circuit (an extra Chonk folding step).
    #[external("private")]
    fn claim_split(
        e: u64,
        nonce: Field,
        out: Field,
        secret: Field,
        proof: [Field; RECURSIVE_PROOF_LENGTH],
        recipient: AztecAddress,
    ) {
        let (params, token) = self.internal.read_epoch_and_token(e);
        let public_inputs = self.internal.public_inputs(e, nonce, out, secret, params.seed);
        let digest = self.call(
            ElixirSpike::at(self.context.this_address()).verify_ticket(proof, public_inputs),
        );
        self.internal.settle(e, digest, params.target, token, recipient);
    }

    #[only_self]
    #[external("private")]
    fn verify_ticket(proof: [Field; RECURSIVE_PROOF_LENGTH], public_inputs: [Field; NUM_PUBLIC_INPUTS]) -> Field {
        verify_honk_proof_non_zk(W_VK, proof, public_inputs, W_VK_HASH);
        ticket_digest(proof)
    }

    // A doomed claim (epoch already closed at the anchor block) fails here, before proving.
    #[internal("private")]
    fn read_epoch_and_token(e: u64) -> (EpochParams, AztecAddress) {
        let open = public_storage_historical_read(
            self.context.get_anchor_block_header(),
            self.storage.open_epoch.get_storage_slot(),
            self.context.this_address(),
        );
        assert(open == e as Field, "epoch is not open");
        (self.storage.epochs.at(e).read(), self.storage.token.read())
    }

    #[internal("private")]
    fn public_inputs(e: u64, nonce: Field, out: Field, secret: Field, seed: Field) -> [Field; NUM_PUBLIC_INPUTS] {
        let domain = Poseidon2::hash(
            [DOM_DEPLOY, self.context.chain_id(), self.context.this_address().to_field(), VERSION],
            4,
        );
        let commit = Poseidon2::hash([DOM_SECRET, secret], 2);
        [domain, seed, e as Field, commit, nonce, out]
    }

    // record_claim is enqueued before the mint so a stale claim reverts before any mint work.
    #[internal("private")]
    fn settle(e: u64, digest: Field, target: u128, token: AztecAddress, recipient: AztecAddress) {
        assert(low128(digest) < target, "ticket above target");
        self.context.push_nullifier_unsafe(Poseidon2::hash([DOM_NULL, digest], 2));
        self.enqueue_self.record_claim(e, digest);
        self.call(Token::at(token).mint_to_private(recipient, REWARD));
    }

    #[external("public")]
    #[only_self]
    fn record_claim(e: u64, _digest: Field) {
        assert(e == self.storage.open_epoch.read(), "stale claim");
        let count = self.storage.claims.at(e).read();
        assert(count < N, "epoch full");
        self.storage.claims.at(e).write(count + 1);
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
}
