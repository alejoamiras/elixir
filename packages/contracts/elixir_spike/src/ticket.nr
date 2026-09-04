use bb_proof_verification::RECURSIVE_PROOF_LENGTH;
use elixir_work_lib::DOM_TICKET;
use poseidon::poseidon2::Poseidon2;

// The ticket: Poseidon2 over the domain tag and all 410 proof fields (254-bit).
pub fn ticket_digest(proof: [Field; RECURSIVE_PROOF_LENGTH]) -> Field {
    let mut input = [0; RECURSIVE_PROOF_LENGTH + 1];
    input[0] = DOM_TICKET;
    for i in 0..RECURSIVE_PROOF_LENGTH {
        input[i + 1] = proof[i];
    }
    Poseidon2::hash(input, RECURSIVE_PROOF_LENGTH + 1)
}

// Low 128 bits of a field element, compared against the u128 target.
pub fn low128(x: Field) -> u128 {
    let bytes: [u8; 32] = x.to_le_bytes();
    let mut lo: u128 = 0;
    for i in 0..16 {
        lo = lo * 256 + (bytes[15 - i] as u128);
    }
    lo
}
