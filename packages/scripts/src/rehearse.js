/**
 * The eight-step demo, run once against testnet, with every hash recorded.
 *
 * #20: if the network is slow during the presentation, the backup hashes are
 * what gets shown. They are only backup if they are real, so this drives the
 * validator through the same HTTP endpoints the panels call, in the order of
 * the demo table in docs/01-pitch.md, and then reads every hash back from
 * Horizon. A hash that does not resolve fails at the one moment it was kept
 * for, which is worse than having none.
 *
 * Needs a validator running. The env it expects is in packages/validator's
 * README; the demo campaign id does not matter, because this opens its own.
 *
 *   npm run rehearse                 run the flow, verify, write the doc
 *   npm run rehearse -- --record-only   re-write the doc from the last run
 *
 * The second form exists because the doc carries hand-written analysis under
 * "What the run says", and regenerating should not throw that away. Any
 * section this file does not own is lifted out of the existing doc and put
 * back where it was.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const RECORD_PATH = join(HERE, '..', 'rehearsal.json');
const DOC_PATH = join(ROOT, 'docs', '04-demo-rehearsal.md');

const BASE = process.env.VALIDATOR ?? 'http://localhost:8787';
const HORIZON = process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
const EXPLORER = 'https://stellar.expert/explorer/testnet';

/**
 * A budget of three actions at the pitch's own numbers, so the shares on
 * screen are the ones the pitch quotes: 1.20 to the player, 1.80 to the
 * publisher, 1.00 to the platform.
 */
const CAMPAIGN_BUDGET = 12;
const PER_ACTION = 4;

/* ------------------------------------------------------------------ *
 * Running the flow
 * ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = [payload.error, payload.detail ?? payload.reason].filter(Boolean).join(' — ');
    throw new Error(`${path}: ${reason || res.status}`);
  }
  return payload;
}

const post = (path, body) => call('POST', path, body ?? {});
const get = (path) => call('GET', path);

async function runFlow() {
  const steps = [];
  let current = null;
  const startedAt = Date.now();
  const stamp = Date.now();

  const begin = (minute, name, narration) => {
    current = { minute, name, narration, seconds: 0, txs: [], notes: [], _at: Date.now() };
    steps.push(current);
    process.stdout.write(`\n[${minute}] ${name}\n`);
  };
  const end = () => {
    current.seconds = Number(((Date.now() - current._at) / 1000).toFixed(1));
    delete current._at;
    process.stdout.write(`      ${current.seconds}s\n`);
  };
  const tx = (label, ref) => {
    if (!ref?.hash) return;
    current.txs.push({ label, hash: ref.hash, url: ref.url });
    process.stdout.write(`      ${label}: ${ref.hash}\n`);
  };
  const note = (text) => {
    current.notes.push(text);
    process.stdout.write(`      · ${text}\n`);
  };

  const health = await get('/health');

  /* 0:40 — the advertiser locks a budget ------------------------------- */
  begin('0:40', 'Campaign opening', 'The budget is locked in a contract, not held by us.');
  const opened = await post('/campaign/open', { budget: CAMPAIGN_BUDGET, perAction: PER_ACTION });
  const campaignId = opened.campaignId;
  tx('open_campaign', opened.tx);
  note(`campaign ${campaignId}, ${CAMPAIGN_BUDGET} USDC at ${PER_ACTION} per action`);
  end();

  /* 1:10 — two players sign in ----------------------------------------- */
  begin('1:10', 'Player signup', 'An email and nothing else. No wallet, no seed, no XLM.');
  const honest = await post('/player/signup', { email: `honest-${stamp}@rehearsal.test` });
  tx('sponsored account (honest)', honest.signupTx);
  const fraud = await post('/player/signup', { email: `fraud-${stamp}@rehearsal.test` });
  tx('sponsored account (fraudster)', fraud.signupTx);
  note(`honest ${honest.player}`);
  note(`fraudster ${fraud.player}`);
  end();

  /* 1:40 — both complete a task ---------------------------------------- */
  begin('1:40', 'Task completion', 'One verified action, three shares, one transaction.');
  const honestAction = await post('/action/complete', { campaignId, player: honest.player });
  tx('settle (honest)', honestAction.settleTx);
  tx('REWARD paid (honest)', honestAction.rewardTx);
  const fraudAction = await post('/action/complete', { campaignId, player: fraud.player });
  tx('settle (fraudster)', fraudAction.settleTx);
  tx('REWARD paid (fraudster)', fraudAction.rewardTx);
  note(`each credited ${honestAction.amount}`);
  end();

  /* 2:10 — the honest player cashes out -------------------------------- */
  begin('2:10', 'Instant withdrawal', 'No threshold. The fee is a rounding error against the reward.');
  const window = health.tiers.clawbackWindowSeconds;
  note(`waiting out the ${window}s clawback window — a new account, so the reward is frozen`);
  // The trustline stays unauthorised for the window's length, so this is the
  // chain refusing rather than the validator being polite. Waiting is the
  // honest way to show it.
  await sleep((window + 5) * 1000);
  const converted = await post('/player/convert', { campaignId, player: honest.player });
  tx('REWARD burned', converted.burnTx);
  tx('payout withdrawn', converted.withdrawTx);
  note(`${converted.amount} USDC now the player's, unreversible`);
  end();

  /* 2:40 — the publisher pulls its share ------------------------------- */
  begin('2:40', 'Publisher withdrawal', 'Accrued per action, withdrawn on demand, no minimum.');
  const withdrawn = await post('/publisher/withdraw', { campaignId });
  tx('withdraw', withdrawn.tx);
  note(`${withdrawn.amount} USDC out of escrow`);
  end();

  /* 3:00 — the exit to local currency ---------------------------------- */
  begin('3:00', 'Cash out', 'The anchor confirms the payout, and the bank details never reach us.');
  try {
    const cashout = await post('/player/cashout', { player: honest.player, amount: 1 });
    note(`anchor transaction \`${cashout.anchorTransactionId}\``);
    note(
      cashout.interactiveUrl
        ? `interactive ${cashout.interactiveUrl}`
        : 'no interactive URL: this anchor is SEP-6, which has no hosted page',
    );
  } catch (err) {
    note(`anchor refused: ${err.message}`);
  }
  end();

  /* 3:20 — fraud, after the payout ------------------------------------- */
  begin('3:20', 'Fraud scenario', 'The reward comes back. The honest player is untouched.');
  const flagged = await post('/fraud/flag', { campaignId, player: fraud.player });
  tx('clawback', flagged.clawbackTx);
  tx('refund to campaign', flagged.refundTx);
  note(`${flagged.clawedBack} REWARD reversed`);
  // Flagging the honest player too is the point, not a mistake: it is the
  // only way to show that the window is a boundary rather than a preference.
  const untouched = await post('/fraud/flag', { campaignId, player: honest.player });
  note(`honest player: ${untouched.note ?? `${untouched.clawedBack} reversed`}`);
  end();

  /* 3:45 — closing ------------------------------------------------------ */
  begin('3:45', 'Campaign closing', 'Unspent budget goes back to the advertiser, by contract.');
  const closed = await post('/campaign/close', { campaignId });
  tx('close_campaign', closed.tx);
  note(`${closed.refunded} USDC refunded`);
  end();

  return {
    ranAt: new Date().toISOString(),
    totalSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
    campaignId,
    escrow: health.escrow,
    payoutSac: health.tusdcSac,
    validator: health.validator,
    players: { honest: honest.player, fraudster: fraud.player },
    steps,
  };
}

/* ------------------------------------------------------------------ *
 * Verifying
 * ------------------------------------------------------------------ */

async function verify(record) {
  for (const step of record.steps) {
    for (const tx of step.txs) {
      const res = await fetch(`${HORIZON}/transactions/${tx.hash}`);
      const body = res.ok ? await res.json() : null;
      tx.verified = body?.successful === true;
      tx.ledger = body?.ledger;
      process.stdout.write(`${tx.verified ? 'ok  ' : 'FAIL'} ${tx.hash} ${tx.label}\n`);
    }
  }
  return record.steps.flatMap((s) => s.txs.filter((t) => !t.verified));
}

/* ------------------------------------------------------------------ *
 * Writing the page someone reads while presenting
 * ------------------------------------------------------------------ */

/** Sections this file writes. Anything else in the doc is somebody's prose. */
const OWNED = new Set([
  'The run',
  'Timing against the four-minute script',
  'The hashes',
  'Tabs to open before presenting',
  'Full hashes',
]);

/**
 * Lift the sections this file does not own out of the existing doc.
 *
 * The analysis under "What the run says" is judgement, not output, and
 * regenerating the tables should not silently delete it. Each kept section is
 * remembered along with the owned section it followed, so it goes back in the
 * same place.
 */
function keepUnownedSections(path) {
  if (!existsSync(path)) return [];
  const kept = [];
  let after = null;
  let buffer = null;

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const heading = line.startsWith('## ') ? line.slice(3).trim() : null;
    if (heading) {
      if (buffer) kept.push({ after, text: buffer.join('\n').trimEnd() });
      if (OWNED.has(heading)) {
        buffer = null;
        after = heading;
      } else {
        buffer = [line];
      }
      continue;
    }
    if (buffer) buffer.push(line);
  }
  if (buffer) kept.push({ after, text: buffer.join('\n').trimEnd() });
  return kept;
}

function renderDoc(record, failures, kept) {
  const out = [];
  const section = (heading) => {
    out.push(`## ${heading}`, '');
    return heading;
  };
  const closeSection = (heading) => {
    for (const block of kept.filter((k) => k.after === heading)) out.push(block.text, '');
  };

  const url = {
    tx: (h) => `${EXPLORER}/tx/${h}`,
    account: (a) => `${EXPLORER}/account/${a}`,
    contract: (c) => `${EXPLORER}/contract/${c}`,
  };
  const windowStep = record.steps.find((s) => s.minute === '2:10');
  const allTxs = record.steps.flatMap((s) => s.txs);

  out.push('# Demo rehearsal — backup hashes');
  out.push('');
  out.push(
    `*One clean run of the eight-step script on Stellar testnet, ${record.ranAt.slice(0, 10)} ${record.ranAt.slice(11, 16)} UTC.*`,
  );
  out.push('');
  out.push(
    'Every hash below was produced by the same endpoints the panels call, in the',
    'order of the demo script in `01-pitch.md`, and then read back from Horizon to',
    'confirm it resolves and succeeded. If testnet is slow during the presentation,',
    'these are what gets shown — which only works if they are real, so they are',
    'checked rather than copied.',
    '',
  );

  for (const block of kept.filter((k) => k.after === null)) out.push(block.text, '');

  let at = section('The run');
  out.push('| | |', '| --- | --- |');
  out.push(`| Campaign | ${record.campaignId} |`);
  out.push(`| Escrow | [\`${record.escrow}\`](${url.contract(record.escrow)}) |`);
  out.push(`| Payout asset SAC | [\`${record.payoutSac}\`](${url.contract(record.payoutSac)}) |`);
  out.push(`| Validator key | [\`${record.validator}\`](${url.account(record.validator)}) |`);
  out.push(`| Honest player | [\`${record.players.honest}\`](${url.account(record.players.honest)}) |`);
  out.push(`| Fraudulent player | [\`${record.players.fraudster}\`](${url.account(record.players.fraudster)}) |`);
  out.push(`| Wall clock | ${record.totalSeconds}s, of which ${windowStep.seconds}s is the clawback window |`);
  out.push(
    `| Transactions | ${allTxs.length}, ${failures.length === 0 ? 'all verified on Horizon' : `**${failures.length} did NOT verify**`} |`,
  );
  out.push('');
  closeSection(at);

  at = section('Timing against the four-minute script');
  out.push('| Slot | Step | Took | Narration |', '| --- | --- | --- | --- |');
  for (const s of record.steps) out.push(`| ${s.minute} | ${s.name} | ${s.seconds}s | ${s.narration} |`);
  out.push('');
  closeSection(at);

  at = section('The hashes');
  for (const step of record.steps) {
    out.push(`### ${step.minute} — ${step.name}`, '');
    for (const note of step.notes) out.push(`- ${note}`);
    if (step.notes.length > 0) out.push('');
    if (step.txs.length === 0) {
      out.push(
        'No chain transaction of ours. The withdrawal is opened on the anchor\'s',
        'server and the payment leaves when the anchor is satisfied, which is the',
        'point — the payout details never reach us.',
        '',
      );
      continue;
    }
    out.push('| What | Transaction |', '| --- | --- |');
    for (const tx of step.txs) {
      const mark = tx.verified ? '' : ' **UNVERIFIED**';
      out.push(`| ${tx.label}${mark} | [\`${tx.hash.slice(0, 16)}…\`](${url.tx(tx.hash)}) |`);
    }
    out.push('');
  }
  closeSection(at);

  at = section('Tabs to open before presenting');
  out.push('In this order, so the narrative never waits on a search box.', '');
  out.push('1. The console itself — `/demo`');
  out.push(`2. Escrow contract — ${url.contract(record.escrow)}`);
  out.push(`3. Honest player — ${url.account(record.players.honest)}`);
  out.push(`4. Fraudulent player — ${url.account(record.players.fraudster)}`);
  let n = 5;
  for (const step of record.steps) {
    for (const tx of step.txs) {
      out.push(`${n}. ${step.minute} ${tx.label} — ${url.tx(tx.hash)}`);
      n += 1;
    }
  }
  out.push('');
  closeSection(at);

  at = section('Full hashes');
  out.push('For copying into a terminal or a search box when a link is not to hand.', '');
  out.push('```');
  for (const step of record.steps) {
    for (const tx of step.txs) out.push(`${step.minute}  ${tx.label.padEnd(30)} ${tx.hash}`);
  }
  out.push('```', '');
  closeSection(at);

  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/* ------------------------------------------------------------------ *
 * Entry
 * ------------------------------------------------------------------ */

const recordOnly = process.argv.includes('--record-only');

async function main() {
  let record;
  if (recordOnly) {
    if (!existsSync(RECORD_PATH)) {
      throw new Error(`${RECORD_PATH} not found — run without --record-only first`);
    }
    record = JSON.parse(readFileSync(RECORD_PATH, 'utf8'));
    process.stdout.write(`re-recording the run of ${record.ranAt}\n\n`);
  } else {
    record = await runFlow();
    writeFileSync(RECORD_PATH, JSON.stringify(record, null, 2) + '\n');
    process.stdout.write(`\ntotal ${record.totalSeconds}s\n\n`);
  }

  const failures = await verify(record);
  writeFileSync(RECORD_PATH, JSON.stringify(record, null, 2) + '\n');

  const kept = keepUnownedSections(DOC_PATH);
  writeFileSync(DOC_PATH, renderDoc(record, failures, kept) + '\n');

  process.stdout.write(`\n${DOC_PATH}\n`);
  if (kept.length > 0) {
    process.stdout.write(`kept ${kept.length} hand-written section(s): ${kept.map((k) => k.text.split('\n')[0]).join(', ')}\n`);
  }
  if (failures.length > 0) {
    process.stdout.write(`\n${failures.length} transaction(s) did not verify — do not present these as backup\n`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`\nrehearsal stopped: ${err.message}`);
  process.exitCode = 1;
});
