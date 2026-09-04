// Plain (non-Aztec) recursive verifier of a W proof against the embedded W_VK. Used to inspect
// the ACIR for VK pinning and to measure the recursive verifier outside Chonk; the real claim
// verification lives in the miner contract.
mod vk;

use bb_proof_verification::{RECURSIVE_PROOF_LENGTH, verify_honk_proof_non_zk};
use vk::{W_VK, W_VK_HASH};

global NUM_PUBLIC_INPUTS: u32 = 6;

fn main(proof: [Field; RECURSIVE_PROOF_LENGTH], public_inputs: pub [Field; NUM_PUBLIC_INPUTS]) {
    verify_honk_proof_non_zk(W_VK, proof, public_inputs, W_VK_HASH);
}

// Documents, rather than protects against, a property of the toolchain: the ACVM (nargo test, TXE,
// PXE simulation) does not evaluate the recursive-aggregation black box, so an all-zero "proof"
// passes here. Only real proving rejects it — every proof-validity test must prove.
#[test]
fn acvm_does_not_check_the_recursive_proof() {
    verify_honk_proof_non_zk(W_VK, [0; RECURSIVE_PROOF_LENGTH], [0; NUM_PUBLIC_INPUTS], W_VK_HASH);
}
