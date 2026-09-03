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
