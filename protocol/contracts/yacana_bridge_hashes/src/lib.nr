// The four message contents the miner and the portal agree on, hashed as Aztec's own token portal
// does: the first four bytes of keccak256 of the ABI-style signature, then each argument as a
// 32-byte big-endian word, then sha256 truncated into a field. The signature makes each kind's
// content unique; nothing ever calls it. YacanaHashes.sol and packages/bridge compute the same
// bytes; the generated vectors in test.nr pin all three.
use aztec::protocol::{address::EthAddress, hash::{compute_log_tag, sha256_to_field}, traits::ToField};
use yacana_work_lib::SEP_EXIT_LOG;

mod test;

comptime fn selector<let N: u32>(signature: str<N>) -> [u8; 4] {
    let hash = keccak256::keccak256(signature.as_bytes(), N);
    [hash[0], hash[1], hash[2], hash[3]]
}

fn words<let W: u32>(sel: [u8; 4], args: [Field; W]) -> [u8; 4 + 32 * W] {
    let mut bytes = [0; 4 + 32 * W];
    for i in 0..4 {
        bytes[i] = sel[i];
    }
    for w in 0..W {
        let arg: [u8; 32] = args[w].to_be_bytes();
        for i in 0..32 {
            bytes[4 + 32 * w + i] = arg[i];
        }
    }
    bytes
}

/// K1: burn here, mint YACA to `recipient`; `tag` is a hash only the sender recognises.
pub fn exit_content(recipient: EthAddress, amount: u128, tag: Field) -> Field {
    let sel = comptime { selector("exit_to_l1(address,uint256,bytes32)") };
    sha256_to_field(words(sel, [recipient.to_field(), amount as Field, tag]))
}

/// K2: burn here, held on Ethereum for the next version; `redeem_key` alone may forward or redeem it.
pub fn send_ahead_content(amount: u128, secret_hash: Field, redeem_key: EthAddress) -> Field {
    let sel = comptime { selector("send_ahead(uint256,bytes32,address)") };
    sha256_to_field(words(sel, [amount as Field, secret_hash, redeem_key.to_field()]))
}

/// K4: the portal's message into this version's Inbox; the secret hash rides on the message itself.
pub fn claim_content(amount: u128) -> Field {
    let sel = comptime { selector("claim_from_l1(uint256)") };
    sha256_to_field(words(sel, [amount as Field]))
}

/// K5: the portal tells this version's miner that mining is over.
pub fn retire_content(version: Field) -> Field {
    let sel = comptime { selector("retire(uint256)") };
    sha256_to_field(words(sel, [version]))
}

/// The second tag an exit is logged under: its own hash, so the owner finds it in one query.
pub fn exit_log_tag(hash_or_tag: Field) -> Field {
    compute_log_tag(hash_or_tag, SEP_EXIT_LOG)
}
