use bb_proof_verification::{verify_honk_proof_non_zk, RECURSIVE_PROOF_LENGTH, ULTRA_VK_LENGTH_IN_FIELDS};
fn main(vk: [Field; ULTRA_VK_LENGTH_IN_FIELDS], proof: [Field; RECURSIVE_PROOF_LENGTH], pi: [Field; 5], key_hash: Field) {
    verify_honk_proof_non_zk(vk, proof, pi, key_hash);
}
