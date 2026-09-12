// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.30;

import {ECDSA} from "@oz/utils/cryptography/ECDSA.sol";
import {EIP712} from "@oz/utils/cryptography/EIP712.sol";
import {SafeCast} from "@oz/utils/math/SafeCast.sol";
import {DataStructures} from "@aztec/DataStructures.sol";
import {IInbox} from "@aztec/IInbox.sol";
import {IOutbox} from "@aztec/IOutbox.sol";
import {IHaveVersion, IRegistry} from "@aztec/IRegistry.sol";
import {Epoch} from "@aztec/TimeLib.sol";
import {YACA} from "./YACA.sol";
import {YacanaHashes} from "./YacanaHashes.sol";

/// The boxes of one rollup version, as the portal reaches them.
interface IVersionRollup is IHaveVersion {
  function getInbox() external view returns (IInbox);
  function getOutbox() external view returns (IOutbox);
}

/// Yacana's one contract on Ethereum: it consumes the exits every registered rollup version wrote
/// into its own Outbox and either mints YACA (an exit to Ethereum) or writes the amount into the
/// live version's Inbox (a send-ahead), and it burns YACA into a deposit. Nothing crosses without
/// passing here, and what may cross is bounded per version: a cap that grows on wall time with the
/// mining schedule and freezes when the Registry moves on, a pause, and a deadline after which a
/// version's exits are closed for good. The policy is fixed at deployment; the operators choose
/// which miner a version trusts, when to pause, and when deposits close — never how much may issue.
contract YacanaPortal is EIP712 {
  using SafeCast for uint256;

  // ---- policy, fixed at deployment -------------------------------------------------------------

  /// Cap growth per hour of a version's life, and the allowance a version starts with.
  uint128 public immutable PER_HOUR;
  uint128 public immutable ALLOWANCE;
  /// Exits close this long after a version's flip at the earliest (later if the version after next
  /// is slower to arrive, and later still by however long the version was paused).
  uint64 public immutable EXIT_FLOOR;
  uint64 public immutable PAUSE_MAX;
  uint64 public immutable PAUSE_BUDGET;
  /// A registration's launch time may sit this far behind or ahead of the registration block.
  uint64 public immutable LAUNCH_BACKDATE;
  uint64 public immutable LAUNCH_AHEAD;
  /// Gas each leaf of a batch runs under, so one exhausted leaf cannot exhaust the batch.
  uint256 public immutable LEAF_GAS;

  IRegistry public immutable REGISTRY;
  YACA public immutable YACA_TOKEN;

  struct Policy {
    uint128 perHour;
    uint128 allowance;
    uint64 exitFloor;
    uint64 pauseMax;
    uint64 pauseBudget;
    uint64 launchBackdate;
    uint64 launchAhead;
    uint256 leafGas;
  }

  // ---- state ------------------------------------------------------------------------------------

  address public operators;
  mapping(address forwarder => bool listed) public forwarders;
  uint256[] public registeredVersions;
  /// When the portal first saw the Registry hold a version at this index; 0 = never seen. An
  /// observed time is never earlier than the true activation, so a delayed record can only extend
  /// a holder's window, never shorten it.
  mapping(uint256 index => uint64 observedAt) public transitions;

  struct VersionInfo {
    bytes32 miner;
    uint64 registryIndex;
    uint64 launchAt;
    uint64 pausedUntil;
    uint64 pausedSeconds;
    uint128 exited;
    uint128 inbound;
    bool registered;
    bool retireSent;
    bool depositsClosed;
  }

  mapping(uint256 version => VersionInfo) internal versions;

  struct ForwardArgs {
    uint8 kind;
    uint256 amount;
    /// The exit's tag (kind 1) or secret hash (kind 2).
    bytes32 aux;
    /// The Ethereum recipient (kind 1) or the redeem key (kind 2), as the L2 wrote it.
    address recipientOrRedeemKey;
    Epoch epoch;
    uint256 numCheckpointsInEpoch;
    uint256 leafIndex;
    bytes32[] path;
    /// Kind 2 only, when the caller is not a listed forwarder: the redeem key's Forward signature.
    bytes sig;
    uint64 expiry;
  }

  bytes32 private constant FORWARD_TYPEHASH = keccak256(
    "Forward(uint256 version,uint256 epoch,uint256 leafId,bytes32 contentHash,uint256 target,uint256 expiry)"
  );
  bytes32 private constant REDEEM_TYPEHASH = keccak256(
    "Redeem(uint256 version,uint256 epoch,uint256 leafId,bytes32 contentHash,address recipient,uint256 expiry)"
  );

  // ---- events -----------------------------------------------------------------------------------

  event VersionRegistered(uint256 indexed version, uint256 indexed index, bytes32 miner, uint64 launchAt);
  event TransitionObserved(uint256 indexed index, uint64 at);
  event Retired(uint256 indexed version, uint256 inboxIndex);
  event Forwarded(
    uint256 indexed version,
    Epoch indexed epoch,
    uint256 indexed leafId,
    uint8 kind,
    uint256 amount,
    bytes32 aux,
    uint256 target,
    uint256 inboxIndex
  );
  event Deposited(uint256 indexed version, address indexed sender, uint256 amount, bytes32 secretHash, uint256 inboxIndex);
  event Redeemed(uint256 indexed version, Epoch indexed epoch, uint256 indexed leafId, address recipient, uint256 amount);
  event Paused(uint256 indexed version, uint64 until);
  event PauseSkipped(uint256 indexed version);
  event Unpaused(uint256 indexed version);
  event DepositsClosed(uint256 indexed version);
  event ForwarderSet(address indexed forwarder, bool listed);
  event OperatorsSet(address indexed operators);
  /// A batch position, not a leaf id: the id is derived from the leaf's own path and may not be
  /// computable for a malformed entry.
  event LeafFailed(uint256 indexed version, uint256 indexed position, Epoch epoch, bytes reason);

  // ---- errors -----------------------------------------------------------------------------------

  error NotOperators(address caller);
  error AlreadyRegistered(uint256 version);
  error NotRegistered(uint256 version);
  error VersionIndexMismatch(uint256 version, uint256 index);
  error LaunchOutOfWindow(uint64 launchAt);
  error FlipUnrecorded(uint256 version);
  error RetireAlreadySent(uint256 version);
  error VersionPaused(uint256 version);
  error DeadlinePassed(uint256 version);
  error WaitsForHeadroom(uint256 version, uint256 amount, uint256 headroom);
  error BadKind(uint8 kind);
  error NotForwardable(uint256 version, uint256 target);
  error NotAuthorised(address caller);
  error SignatureExpired(uint64 expiry);
  error NotCanonical(uint256 version);
  error DepositsAreClosed(uint256 version);
  error DeadlineExpired(uint256 deadline);
  error PauseTooLong(uint64 seconds_);
  error PauseBudgetExhausted(uint256 version);
  error NotSelf();
  error ZeroOperators();

  modifier onlyOperators() {
    require(msg.sender == operators, NotOperators(msg.sender));
    _;
  }

  constructor(IRegistry registry, address operators_, Policy memory p, string memory name_, string memory symbol_)
    EIP712("YacanaPortal", "1")
  {
    require(operators_ != address(0), ZeroOperators());
    REGISTRY = registry;
    operators = operators_;
    PER_HOUR = p.perHour;
    ALLOWANCE = p.allowance;
    EXIT_FLOOR = p.exitFloor;
    PAUSE_MAX = p.pauseMax;
    PAUSE_BUDGET = p.pauseBudget;
    LAUNCH_BACKDATE = p.launchBackdate;
    LAUNCH_AHEAD = p.launchAhead;
    LEAF_GAS = p.leafGas;
    YACA_TOKEN = new YACA(name_, symbol_, address(this));
    emit OperatorsSet(operators_);
  }

  // ---- transitions ------------------------------------------------------------------------------

  /// Records, for every index up to the version after next, that the Registry now holds a version
  /// there. Called first by every state-changing entrypoint, so a version anyone touches is never
  /// unrecorded past that call; a reverting call rolls its record back with it, which is why
  /// `noteTransition` exists as a call that only records.
  function _sync(uint256 version) internal {
    VersionInfo storage v = versions[version];
    uint256 n = REGISTRY.numberOfVersions();
    for (uint256 k = v.registryIndex; k <= v.registryIndex + 2; k++) {
      if (n > k && transitions[k] == 0) {
        transitions[k] = uint64(block.timestamp);
        emit TransitionObserved(k, uint64(block.timestamp));
      }
    }
  }

  function noteTransition(uint256 index) external {
    if (REGISTRY.numberOfVersions() > index && transitions[index] == 0) {
      transitions[index] = uint64(block.timestamp);
      emit TransitionObserved(index, uint64(block.timestamp));
    }
  }

  function flipAt(uint256 version) public view returns (uint64) {
    return transitions[versions[version].registryIndex + 1];
  }

  function afterNextAt(uint256 version) public view returns (uint64) {
    return transitions[versions[version].registryIndex + 2];
  }

  // ---- registration -----------------------------------------------------------------------------

  /// Write-once: a version's miner and launch time are never changed, so an old version's exits can
  /// never be repointed. The index is checked against the Registry rather than scanned for, so
  /// versions may be registered in any order.
  function registerVersion(uint256 version, uint256 index, bytes32 miner, uint64 launchAt) external onlyOperators {
    VersionInfo storage v = versions[version];
    require(!v.registered, AlreadyRegistered(version));
    require(REGISTRY.getVersion(index) == version, VersionIndexMismatch(version, index));
    require(
      launchAt + LAUNCH_BACKDATE >= block.timestamp && launchAt <= block.timestamp + LAUNCH_AHEAD,
      LaunchOutOfWindow(launchAt)
    );
    v.registered = true;
    v.miner = miner;
    v.registryIndex = index.toUint64();
    v.launchAt = launchAt;
    registeredVersions.push(version);
    _sync(version);
    emit VersionRegistered(version, index, miner, launchAt);
  }

  // ---- the bound --------------------------------------------------------------------------------

  /// What a version may have issued in total, net of what came into it: grows on wall time from
  /// its launch and freezes at the observed flip, because retirement ends honest minting minutes
  /// after it. Before the launch it is the allowance alone.
  function cap(uint256 version) public view returns (uint256) {
    VersionInfo storage v = versions[version];
    uint64 flip = flipAt(version);
    uint256 until = flip == 0 ? block.timestamp : flip;
    uint256 lived = until > v.launchAt ? until - v.launchAt : 0;
    return uint256(ALLOWANCE) + (uint256(PER_HOUR) * lived) / 3600;
  }

  function headroom(uint256 version) public view returns (uint256) {
    VersionInfo storage v = versions[version];
    uint256 allowed = cap(version) + v.inbound;
    return allowed > v.exited ? allowed - v.exited : 0;
  }

  /// Open until the later of the version after next arriving and the flip plus the floor, both
  /// extended by every second the version was paused. Unseen means open: while the flip or the
  /// version after next is unrecorded the deadline is type(uint256).max, never the floor alone.
  function deadline(uint256 version) public view returns (uint256) {
    uint64 flip = flipAt(version);
    uint64 next = afterNextAt(version);
    if (flip == 0 || next == 0) return type(uint256).max;
    uint256 floor = uint256(flip) + EXIT_FLOOR;
    uint256 later = next > floor ? next : floor;
    return later + versions[version].pausedSeconds;
  }

  function isPaused(uint256 version) public view returns (bool) {
    return versions[version].pausedUntil > block.timestamp;
  }

  function _requireOpen(uint256 version, uint256 amount) internal view {
    VersionInfo storage v = versions[version];
    require(v.registered, NotRegistered(version));
    require(!isPaused(version), VersionPaused(version));
    require(block.timestamp <= deadline(version), DeadlinePassed(version));
    uint256 room = headroom(version);
    require(amount <= room, WaitsForHeadroom(version, amount, room));
  }

  // ---- retire -----------------------------------------------------------------------------------

  /// Tells a version's miner that mining is over: one message, sent once the Registry has moved on.
  /// Anyone may call it (the runbook's minute-one step), paused or not — it is not an exit.
  function retire(uint256 version) external {
    _sync(version);
    VersionInfo storage v = versions[version];
    require(v.registered, NotRegistered(version));
    require(flipAt(version) != 0, FlipUnrecorded(version));
    require(!v.retireSent, RetireAlreadySent(version));
    v.retireSent = true;
    IInbox inbox = IVersionRollup(address(REGISTRY.getRollup(version))).getInbox();
    (, uint256 index) = inbox.sendL2Message(
      DataStructures.L2Actor(v.miner, version), YacanaHashes.retireContent(version), YacanaHashes.RETIRE_SECRET_HASH
    );
    emit Retired(version, index);
  }

  // ---- forward ----------------------------------------------------------------------------------

  /// Consumes one exit from a version's Outbox. Kind 1 (to Ethereum) is permissionless: it mints
  /// to the recipient the sender named. Kind 2 (sent ahead) needs the holder's signature or a
  /// listed forwarder, because forwarding is one way: a stranger could push a send into a version
  /// about to stop and take away the holder's redeem.
  function forward(uint256 version, ForwardArgs calldata args) external {
    _sync(version);
    _forward(msg.sender, version, args);
  }

  /// Each leaf under its own gas bound; a failed leaf is logged and the batch continues. A leaf's
  /// writes roll back with its failure; the outer `_sync` record survives every leaf.
  function forwardMany(uint256 version, ForwardArgs[] calldata batch) external {
    _sync(version);
    for (uint256 i = 0; i < batch.length; i++) {
      try this.forwardOne{gas: LEAF_GAS}(msg.sender, version, batch[i]) {}
      catch (bytes memory reason) {
        emit LeafFailed(version, i, batch[i].epoch, reason);
      }
    }
  }

  /// The batch's per-leaf entry: only the portal itself may call it, with the batch's original
  /// caller carried explicitly so a listed forwarder's authority survives the self-call.
  function forwardOne(address caller, uint256 version, ForwardArgs calldata args) external {
    require(msg.sender == address(this), NotSelf());
    _forward(caller, version, args);
  }

  function _forward(address caller, uint256 version, ForwardArgs calldata args) internal {
    require(args.kind == 1 || args.kind == 2, BadKind(args.kind));
    _requireOpen(version, args.amount);
    VersionInfo storage v = versions[version];
    bytes32 content = args.kind == 1
      ? YacanaHashes.exitContent(args.recipientOrRedeemKey, args.amount, args.aux)
      : YacanaHashes.sendAheadContent(args.amount, args.aux, args.recipientOrRedeemKey);
    uint256 leafId = (1 << args.path.length) + args.leafIndex;
    uint256 target = 0;
    uint256 inboxIndex = 0;
    if (args.kind == 2) {
      target = _forwardTarget(version);
      if (!forwarders[caller]) {
        _checkSignature(
          Signed(FORWARD_TYPEHASH, version, args.epoch, leafId, content, target, args.expiry),
          args.sig,
          args.recipientOrRedeemKey
        );
      }
    }
    _consume(version, v.miner, content, args);
    v.exited += args.amount.toUint128();
    if (args.kind == 1) {
      YACA_TOKEN.mint(args.recipientOrRedeemKey, args.amount);
    } else {
      versions[target].inbound += args.amount.toUint128();
      inboxIndex = _sendClaim(target, args.amount, args.aux);
    }
    emit Forwarded(version, args.epoch, leafId, args.kind, args.amount, args.aux, target, inboxIndex);
  }

  /// The live version if Yacana registered it and it comes after this one; a skipped version never
  /// strands a send, and a send never goes backwards.
  function _forwardTarget(uint256 version) internal view returns (uint256) {
    uint256 canonical = REGISTRY.getCanonicalRollup().getVersion();
    VersionInfo storage t = versions[canonical];
    require(t.registered && t.registryIndex > versions[version].registryIndex, NotForwardable(version, canonical));
    return canonical;
  }

  function _consume(uint256 version, bytes32 miner, bytes32 content, ForwardArgs calldata args) internal {
    DataStructures.L2ToL1Msg memory message = DataStructures.L2ToL1Msg({
      sender: DataStructures.L2Actor(miner, version),
      recipient: DataStructures.L1Actor(address(this), block.chainid),
      content: content
    });
    IOutbox outbox = IVersionRollup(address(REGISTRY.getRollup(version))).getOutbox();
    outbox.consume(message, args.epoch, args.numCheckpointsInEpoch, args.leafIndex, args.path);
  }

  function _sendClaim(uint256 target, uint256 amount, bytes32 secretHash) internal returns (uint256) {
    IInbox inbox = IVersionRollup(address(REGISTRY.getRollup(target))).getInbox();
    (, uint256 index) = inbox.sendL2Message(
      DataStructures.L2Actor(versions[target].miner, target), YacanaHashes.claimContent(amount), secretHash
    );
    return index;
  }

  /// What a Forward or Redeem signature commits to; the last word is the target version or the
  /// recipient address, per the typehash.
  struct Signed {
    bytes32 typehash;
    uint256 version;
    Epoch epoch;
    uint256 leafId;
    bytes32 content;
    uint256 targetOrRecipient;
    uint64 expiry;
  }

  function _checkSignature(Signed memory s, bytes calldata sig, address signer) internal view {
    require(block.timestamp <= s.expiry, SignatureExpired(s.expiry));
    bytes32 digest = _hashTypedDataV4(
      keccak256(
        abi.encode(s.typehash, s.version, Epoch.unwrap(s.epoch), s.leafId, s.content, s.targetOrRecipient, s.expiry)
      )
    );
    require(ECDSA.recover(digest, sig) == signer, NotAuthorised(signer));
  }

  // ---- deposit ----------------------------------------------------------------------------------

  /// Burns YACA into the live version's Inbox. The caller names the version they reviewed and a
  /// deadline, so a flip between review and inclusion reverts instead of sending into a version
  /// they did not choose; deposits close before an announced flip so no message is stranded.
  function deposit(uint256 amount, bytes32 secretHash, uint256 expectedVersion, uint256 deadline_)
    external
    returns (uint256)
  {
    VersionInfo storage v = versions[expectedVersion];
    require(v.registered, NotRegistered(expectedVersion));
    _sync(expectedVersion);
    require(REGISTRY.getCanonicalRollup().getVersion() == expectedVersion, NotCanonical(expectedVersion));
    require(!isPaused(expectedVersion), VersionPaused(expectedVersion));
    require(!v.depositsClosed, DepositsAreClosed(expectedVersion));
    require(block.timestamp <= deadline_, DeadlineExpired(deadline_));
    YACA_TOKEN.burnFrom(msg.sender, amount);
    v.inbound += amount.toUint128();
    uint256 index = _sendClaim(expectedVersion, amount, secretHash);
    emit Deposited(expectedVersion, msg.sender, amount, secretHash, index);
    return index;
  }

  // ---- redeem -----------------------------------------------------------------------------------

  /// A held send-ahead becomes YACA on Ethereum, by the redeem key's word alone: no waiting period,
  /// the same cap, pause and deadline as a forward, and the one nullifier forward and redeem share.
  function redeem(uint256 version, ForwardArgs calldata args, address recipient, uint64 expiry, bytes calldata sig)
    external
  {
    _sync(version);
    require(args.kind == 2, BadKind(args.kind));
    _requireOpen(version, args.amount);
    VersionInfo storage v = versions[version];
    bytes32 content = YacanaHashes.sendAheadContent(args.amount, args.aux, args.recipientOrRedeemKey);
    uint256 leafId = (1 << args.path.length) + args.leafIndex;
    _checkSignature(
      Signed(REDEEM_TYPEHASH, version, args.epoch, leafId, content, uint256(uint160(recipient)), expiry),
      sig,
      args.recipientOrRedeemKey
    );
    _consume(version, v.miner, content, args);
    v.exited += args.amount.toUint128();
    YACA_TOKEN.mint(recipient, args.amount);
    emit Redeemed(version, args.epoch, leafId, recipient, args.amount);
  }

  // ---- operators --------------------------------------------------------------------------------

  /// A pause holds a version's exits for at most PAUSE_MAX per call and PAUSE_BUDGET in total; the
  /// whole interval is charged now and refunded by `unpause`, and every charged second extends the
  /// deadline. It neither adds nor removes cap: mining on Aztec does not pause with the portal.
  function pause(uint256 version, uint64 seconds_) external onlyOperators {
    _pause(version, seconds_);
  }

  function pauseAll(uint64 seconds_) external onlyOperators {
    for (uint256 i = 0; i < registeredVersions.length; i++) {
      uint256 version = registeredVersions[i];
      _sync(version);
      if (versions[version].pausedSeconds + seconds_ > PAUSE_BUDGET) {
        emit PauseSkipped(version);
        continue;
      }
      _pause(version, seconds_);
    }
  }

  function _pause(uint256 version, uint64 seconds_) internal {
    require(seconds_ <= PAUSE_MAX, PauseTooLong(seconds_));
    VersionInfo storage v = versions[version];
    require(v.registered, NotRegistered(version));
    _sync(version);
    require(v.pausedSeconds + seconds_ <= PAUSE_BUDGET, PauseBudgetExhausted(version));
    uint64 from = v.pausedUntil > block.timestamp ? v.pausedUntil : uint64(block.timestamp);
    v.pausedUntil = from + seconds_;
    v.pausedSeconds += seconds_;
    emit Paused(version, v.pausedUntil);
  }

  function unpause(uint256 version) external onlyOperators {
    VersionInfo storage v = versions[version];
    _sync(version);
    if (v.pausedUntil > block.timestamp) {
      v.pausedSeconds -= v.pausedUntil - uint64(block.timestamp);
      v.pausedUntil = uint64(block.timestamp);
    }
    emit Unpaused(version);
  }

  /// One way: the runbook's step the day before an announced flip.
  function closeDeposits(uint256 version) external onlyOperators {
    require(versions[version].registered, NotRegistered(version));
    _sync(version);
    versions[version].depositsClosed = true;
    emit DepositsClosed(version);
  }

  function setForwarder(address forwarder, bool listed) external onlyOperators {
    forwarders[forwarder] = listed;
    emit ForwarderSet(forwarder, listed);
  }

  function setOperators(address next) external onlyOperators {
    require(next != address(0), ZeroOperators());
    operators = next;
    emit OperatorsSet(next);
  }

  // ---- views ------------------------------------------------------------------------------------

  function versionInfo(uint256 version) external view returns (VersionInfo memory) {
    return versions[version];
  }

  function registeredCount() external view returns (uint256) {
    return registeredVersions.length;
  }
}
