/**
 * In-memory state: players, their completed actions, and the risk tier that
 * follows from both. A restart loses it, which is acceptable for a demo and
 * would obviously be a database in production.
 *
 * The tier rule lives here rather than in the contract because it is a
 * business rule that changes far more often than the contract does. The
 * trade-off is documented in docs/02-technical-spec.md under "Alignment
 * point: the risk tier".
 */
import { config } from './config.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** publicKey -> { label, createdAt, tasks, flagged, lastRewardAt } */
const players = new Map();

/** Append-only log of everything the demo did, newest last. */
const events = [];

export function registerPlayer(publicKey, label, { createdAt = Date.now() } = {}) {
  if (!players.has(publicKey)) {
    players.set(publicKey, {
      publicKey,
      label,
      createdAt,
      tasks: 0,
      flagged: false,
      lastRewardAt: null,
    });
  }
  return players.get(publicKey);
}

export function getPlayer(publicKey) {
  return players.get(publicKey);
}

export function allPlayers() {
  return [...players.values()];
}

export function recordTask(publicKey) {
  const player = players.get(publicKey);
  if (!player) throw new Error(`unknown player ${publicKey}`);
  player.tasks += 1;
  player.lastRewardAt = Date.now();
  return player;
}

/**
 * Note that a reward reached the player, without counting a new task.
 *
 * The clawback window runs from the moment value lands, so a reconciled
 * payment opens a window exactly as a fresh one does. Skipping this would
 * hand out an unfrozen-in-practice reward.
 */
export function recordRewardPaid(publicKey) {
  const player = players.get(publicKey);
  if (!player) throw new Error(`unknown player ${publicKey}`);
  player.lastRewardAt = Date.now();
  return player;
}

export function flagPlayer(publicKey) {
  const player = players.get(publicKey);
  if (!player) throw new Error(`unknown player ${publicKey}`);
  player.flagged = true;
  return player;
}

/**
 * Trusted requires both age and activity. Either alone is easy to game: a bot
 * can wait, and a farm can grind tasks. Requiring both raises the cost of
 * looking trustworthy above the value of a single reward.
 */
export function tierOf(publicKey) {
  const player = players.get(publicKey);
  if (!player) throw new Error(`unknown player ${publicKey}`);

  const ageDays = (Date.now() - player.createdAt) / DAY_MS;
  const oldEnough = ageDays >= config.trustTierMinAgeDays;
  const activeEnough = player.tasks >= config.trustTierMinTasks;

  if (player.flagged) {
    return {
      tier: 'suspicious',
      canConvert: false,
      reason: 'flagged by an operator',
      windowRemainingSeconds: null,
    };
  }

  if (oldEnough && activeEnough) {
    return {
      tier: 'trusted',
      canConvert: true,
      reason: 'account age and task count both satisfied',
      windowRemainingSeconds: 0,
    };
  }

  const elapsed = player.lastRewardAt ? (Date.now() - player.lastRewardAt) / 1000 : Infinity;
  const remaining = Math.max(0, Math.ceil(config.clawbackWindowSeconds - elapsed));

  return {
    tier: 'new',
    canConvert: remaining === 0,
    reason: remaining > 0
      ? 'clawback window still open on the most recent reward'
      : 'clawback window has closed',
    windowRemainingSeconds: remaining,
    missing: {
      ageDays: oldEnough ? 0 : Number((config.trustTierMinAgeDays - ageDays).toFixed(2)),
      tasks: activeEnough ? 0 : config.trustTierMinTasks - player.tasks,
    },
  };
}

export function logEvent(event) {
  events.push({ at: new Date().toISOString(), ...event });
  return event;
}

export function allEvents() {
  return events;
}
