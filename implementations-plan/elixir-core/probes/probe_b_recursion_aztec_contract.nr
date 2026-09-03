use aztec::macros::aztec;

#[aztec]
pub contract ProbeB {
    use aztec::macros::functions::{external, view};
    use bb_proof_verification::{verify_honk_proof_non_zk, RECURSIVE_PROOF_LENGTH, ULTRA_VK_LENGTH_IN_FIELDS};

    #[external("private")]
    fn verify_ticket(vk: [Field; ULTRA_VK_LENGTH_IN_FIELDS], proof: [Field; RECURSIVE_PROOF_LENGTH], pi: [Field; 5], key_hash: Field) -> Field {
        verify_honk_proof_non_zk(vk, proof, pi, key_hash);
        pi[0]
    }

    #[external("private")]
    fn baseline(x: Field) -> Field {
        x + 1
    }
}
