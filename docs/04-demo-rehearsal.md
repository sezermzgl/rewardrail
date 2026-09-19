# Demo rehearsal — backup hashes

*One clean run of the eight-step script on Stellar testnet, 2026-09-19 23:06 UTC.*

Every hash below was produced by the same endpoints the panels call, in the
order of the demo script in `01-pitch.md`, and then read back from Horizon to
confirm it resolves and succeeded. If testnet is slow during the presentation,
these are what gets shown — which only works if they are real, so they are
checked rather than copied.

## Where it runs

| | |
| --- | --- |
| Console | <https://rewardrail.vercel.app/demo> |
| Landing | <https://rewardrail.vercel.app> |
| Validator | <https://rewardrail-validator.onrender.com> |
| Public campaign | 7 — 340 USDC at 4.00 per action, 85 plays |

The console never calls the validator from the browser. It goes through
`/api/validator/*` on the site itself, which attaches the write key server-side
— the reads stay open to anyone, and a POST straight at the validator without
that key is refused.

**Warm the validator before presenting.** It is on Render's free instance type,
which stops the service after fifteen minutes of inactivity; the next request
pays about a minute for the cold start and the in-memory player and tier state
starts empty. Opening the console once, a few minutes ahead, is enough. A
restart in the middle of a run is the case that actually hurts: the clawback
window would read as closed for a reward the ledger still has frozen, which is
F6 in `03-contract-interface.md`.

## The run

| | |
| --- | --- |
| Campaign | 8 |
| Escrow | [`CD6HZHGUURVSRWZAODFFLC7JX5WCXZCXHEXOFPXAE5V5ULAD3NDCVTYI`](https://stellar.expert/explorer/testnet/contract/CD6HZHGUURVSRWZAODFFLC7JX5WCXZCXHEXOFPXAE5V5ULAD3NDCVTYI) |
| Payout asset SAC | [`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) |
| Validator key | [`GALJPQWLJVU64BAH46LTRHZML23JF4YDGYBHHCRWOK75IEKSF5QAGR6S`](https://stellar.expert/explorer/testnet/account/GALJPQWLJVU64BAH46LTRHZML23JF4YDGYBHHCRWOK75IEKSF5QAGR6S) |
| Honest player | [`GBU2TDE22CS4LDEAKYTLC6HV2DSDWENCNIY467YEF2DKC2KOLPFXP6SD`](https://stellar.expert/explorer/testnet/account/GBU2TDE22CS4LDEAKYTLC6HV2DSDWENCNIY467YEF2DKC2KOLPFXP6SD) |
| Fraudulent player | [`GDKKNY2KVWSORYPCFWLWLM7OM2KC423FW7PWPKK4TSXSDED7JYLSMKEE`](https://stellar.expert/explorer/testnet/account/GDKKNY2KVWSORYPCFWLWLM7OM2KC423FW7PWPKK4TSXSDED7JYLSMKEE) |
| Wall clock | 135.4s, of which 75s is the clawback window |
| Transactions | 13, all verified on Horizon |

## Timing against the four-minute script

| Slot | Step | Took | Narration |
| --- | --- | --- | --- |
| 0:40 | Campaign opening | 3.9s | The budget is locked in a contract, not held by us. |
| 1:10 | Player signup | 10.3s | An email and nothing else. No wallet, no seed, no XLM. |
| 1:40 | Task completion | 19.9s | One verified action, three shares, one transaction. |
| 2:10 | Instant withdrawal | 75s | No threshold. The fee is a rounding error against the reward. |
| 2:40 | Publisher withdrawal | 5.4s | Accrued per action, withdrawn on demand, no minimum. |
| 3:00 | Cash out | 5.1s | The anchor confirms the payout, and the bank details never reach us. |
| 3:20 | Fraud scenario | 10.5s | The reward comes back. The honest player is untouched. |
| 3:45 | Campaign closing | 4.6s | Unspent budget goes back to the advertiser, by contract. |

## The hashes

### 0:40 — Campaign opening

- campaign 8, 12 USDC at 4 per action

| What | Transaction |
| --- | --- |
| open_campaign | [`02aa98ead2b23e11…`](https://stellar.expert/explorer/testnet/tx/02aa98ead2b23e11cc8d1cef60a9d571688ffa1e5308fd10ad98795a378812b6) |

### 1:10 — Player signup

- honest GBU2TDE22CS4LDEAKYTLC6HV2DSDWENCNIY467YEF2DKC2KOLPFXP6SD
- fraudster GDKKNY2KVWSORYPCFWLWLM7OM2KC423FW7PWPKK4TSXSDED7JYLSMKEE

| What | Transaction |
| --- | --- |
| sponsored account (honest) | [`339ce47d3c9364a8…`](https://stellar.expert/explorer/testnet/tx/339ce47d3c9364a84a8e255a52cadd937b14ad5d17008f77d68f7f552147da58) |
| sponsored account (fraudster) | [`b0a0825b8e931348…`](https://stellar.expert/explorer/testnet/tx/b0a0825b8e9313488096966ba38d6a29dd3951026ceb8f3ad4aebaec7e78b257) |

### 1:40 — Task completion

- each credited 1.2000000

| What | Transaction |
| --- | --- |
| settle (honest) | [`933df22970798db5…`](https://stellar.expert/explorer/testnet/tx/933df22970798db57c9e71c3fc92344c4c4fbe2faa1e871c7ed2b76788cf6623) |
| REWARD paid (honest) | [`3759c66a7efe2ea5…`](https://stellar.expert/explorer/testnet/tx/3759c66a7efe2ea56b8bf82d459f966858a8a7bd60dba63de44fdb319e542fa2) |
| settle (fraudster) | [`6f2188b8f79fd77b…`](https://stellar.expert/explorer/testnet/tx/6f2188b8f79fd77b1403c7bdb88b63e8936c0bda6e79b112cee86aff077af4a1) |
| REWARD paid (fraudster) | [`432f48a0e11f521c…`](https://stellar.expert/explorer/testnet/tx/432f48a0e11f521cc9b6de3fe459d7234abefa366cc92208d54f7c75ac9d5356) |

### 2:10 — Instant withdrawal

- waiting out the 60s clawback window — a new account, so the reward is frozen
- 1.2000000 USDC now the player's, unreversible

| What | Transaction |
| --- | --- |
| REWARD burned | [`2522319423fa48c2…`](https://stellar.expert/explorer/testnet/tx/2522319423fa48c2ab78a80e065a8c527e59b60002d199a97e51a3f6e5ff2876) |
| payout withdrawn | [`183e386e5e9cf21e…`](https://stellar.expert/explorer/testnet/tx/183e386e5e9cf21e8d983073f50ade2e924a2fe27ac3b4465635ccc850972bb0) |

### 2:40 — Publisher withdrawal

- 3.6000000 USDC out of escrow

| What | Transaction |
| --- | --- |
| withdraw | [`1febf69ed3b4625b…`](https://stellar.expert/explorer/testnet/tx/1febf69ed3b4625b3922a238c74244055c73afab7111454e2180c827bd037441) |

### 3:00 — Cash out

- anchor transaction `sep_im0ffggrilugmkps9wda`
- no interactive URL: this anchor is SEP-6, which has no hosted page

No chain transaction of ours. The withdrawal is opened on the anchor's
server and the payment leaves when the anchor is satisfied, which is the
point — the payout details never reach us.

### 3:20 — Fraud scenario

- 1.2000000 REWARD reversed
- honest player: player already converted — the payout is theirs, the window had closed

| What | Transaction |
| --- | --- |
| clawback | [`9b0b4bb01e070952…`](https://stellar.expert/explorer/testnet/tx/9b0b4bb01e070952a6f50d5ecafa33db4a4a9b83445283b117136bff45697cbe) |
| refund to campaign | [`ecfa74814624cd59…`](https://stellar.expert/explorer/testnet/tx/ecfa74814624cd590eb5d4b5766646c1e378a95fd4fc5266fbe6f55dce106f72) |

### 3:45 — Campaign closing

- 5.2000000 USDC refunded

| What | Transaction |
| --- | --- |
| close_campaign | [`d7b07aedcb5071c4…`](https://stellar.expert/explorer/testnet/tx/d7b07aedcb5071c41d4709ec932d8e95a8db01cefa85374ce4e8b26fbf58f049) |

## What the run says

Four things worth knowing before standing up with this.

**The clawback window does not fit its slot.** The script budgets 0:30 for the
instant withdrawal; the window is 60 seconds and the reward is frozen on the
ledger for all of it, so the step took 75s. Nothing is wrong — that freeze is
the answer to "the window is just your server's promise" — but the narration
has to cover it. Either drop `CLAWBACK_WINDOW_SECONDS` to 30 for the
presentation, or start the window at 1:40 and fill it with the publisher
withdrawal and the anchor, coming back to the player once it has elapsed. The
second reads better: the wait becomes the demonstration rather than a pause in
one.

**Everything else is fast.** Excluding that wait, the eight steps took 60
seconds of chain work in total, and the slowest single call was the pair of
settles at 20s. There is room in four minutes.

**The anchor has no KYC page.** `01-pitch.md` says the interactive URL that
comes back is the anchor's own KYC and payout page. Against the Turkish SEP-6
ramp that is not true: SEP-6 is programmatic and returns a transaction id with
no hosted page, which is what this run got. The claim holds for the SEP-24
reference anchor and not for this one, so the line needs narrowing before it
is said to a judge.

**The money reconciles.** 12 USDC in, two actions releasing 4 each, 1.2 clawed
back into the budget, 5.2 refunded at close — 12 = 8 - 1.2 + 5.2. The escrow
paid out exactly what it took in, and the explorer shows each leg.

## How this was produced

`npm run rehearse` in `packages/scripts`, pointed at the deployed site rather
than at a validator on somebody's laptop:

```
VALIDATOR=https://rewardrail.vercel.app/api/validator npm run rehearse
```

So these hashes are not evidence that the code works. They are evidence that
the published URL works — every call above went through the same proxy, the
same write key and the same container a judge's browser reaches, in the order
of the table in `01-pitch.md`. Each hash was then read back from Horizon to
confirm it resolved and succeeded.

Re-running it opens a new campaign and new player accounts, so it never spends
the one the public console points at, and nothing above is reused. It rewrites
this file too, keeping any section it does not own — the analysis above is
hand-written and survives.

## Tabs to open before presenting

In this order, so the narrative never waits on a search box.

1. The console itself — `/demo`
2. Escrow contract — https://stellar.expert/explorer/testnet/contract/CD6HZHGUURVSRWZAODFFLC7JX5WCXZCXHEXOFPXAE5V5ULAD3NDCVTYI
3. Honest player — https://stellar.expert/explorer/testnet/account/GBU2TDE22CS4LDEAKYTLC6HV2DSDWENCNIY467YEF2DKC2KOLPFXP6SD
4. Fraudulent player — https://stellar.expert/explorer/testnet/account/GDKKNY2KVWSORYPCFWLWLM7OM2KC423FW7PWPKK4TSXSDED7JYLSMKEE
5. 0:40 open_campaign — https://stellar.expert/explorer/testnet/tx/02aa98ead2b23e11cc8d1cef60a9d571688ffa1e5308fd10ad98795a378812b6
6. 1:10 sponsored account (honest) — https://stellar.expert/explorer/testnet/tx/339ce47d3c9364a84a8e255a52cadd937b14ad5d17008f77d68f7f552147da58
7. 1:10 sponsored account (fraudster) — https://stellar.expert/explorer/testnet/tx/b0a0825b8e9313488096966ba38d6a29dd3951026ceb8f3ad4aebaec7e78b257
8. 1:40 settle (honest) — https://stellar.expert/explorer/testnet/tx/933df22970798db57c9e71c3fc92344c4c4fbe2faa1e871c7ed2b76788cf6623
9. 1:40 REWARD paid (honest) — https://stellar.expert/explorer/testnet/tx/3759c66a7efe2ea56b8bf82d459f966858a8a7bd60dba63de44fdb319e542fa2
10. 1:40 settle (fraudster) — https://stellar.expert/explorer/testnet/tx/6f2188b8f79fd77b1403c7bdb88b63e8936c0bda6e79b112cee86aff077af4a1
11. 1:40 REWARD paid (fraudster) — https://stellar.expert/explorer/testnet/tx/432f48a0e11f521cc9b6de3fe459d7234abefa366cc92208d54f7c75ac9d5356
12. 2:10 REWARD burned — https://stellar.expert/explorer/testnet/tx/2522319423fa48c2ab78a80e065a8c527e59b60002d199a97e51a3f6e5ff2876
13. 2:10 payout withdrawn — https://stellar.expert/explorer/testnet/tx/183e386e5e9cf21e8d983073f50ade2e924a2fe27ac3b4465635ccc850972bb0
14. 2:40 withdraw — https://stellar.expert/explorer/testnet/tx/1febf69ed3b4625b3922a238c74244055c73afab7111454e2180c827bd037441
15. 3:20 clawback — https://stellar.expert/explorer/testnet/tx/9b0b4bb01e070952a6f50d5ecafa33db4a4a9b83445283b117136bff45697cbe
16. 3:20 refund to campaign — https://stellar.expert/explorer/testnet/tx/ecfa74814624cd590eb5d4b5766646c1e378a95fd4fc5266fbe6f55dce106f72
17. 3:45 close_campaign — https://stellar.expert/explorer/testnet/tx/d7b07aedcb5071c41d4709ec932d8e95a8db01cefa85374ce4e8b26fbf58f049

## Full hashes

For copying into a terminal or a search box when a link is not to hand.

```
0:40  open_campaign                  02aa98ead2b23e11cc8d1cef60a9d571688ffa1e5308fd10ad98795a378812b6
1:10  sponsored account (honest)     339ce47d3c9364a84a8e255a52cadd937b14ad5d17008f77d68f7f552147da58
1:10  sponsored account (fraudster)  b0a0825b8e9313488096966ba38d6a29dd3951026ceb8f3ad4aebaec7e78b257
1:40  settle (honest)                933df22970798db57c9e71c3fc92344c4c4fbe2faa1e871c7ed2b76788cf6623
1:40  REWARD paid (honest)           3759c66a7efe2ea56b8bf82d459f966858a8a7bd60dba63de44fdb319e542fa2
1:40  settle (fraudster)             6f2188b8f79fd77b1403c7bdb88b63e8936c0bda6e79b112cee86aff077af4a1
1:40  REWARD paid (fraudster)        432f48a0e11f521cc9b6de3fe459d7234abefa366cc92208d54f7c75ac9d5356
2:10  REWARD burned                  2522319423fa48c2ab78a80e065a8c527e59b60002d199a97e51a3f6e5ff2876
2:10  payout withdrawn               183e386e5e9cf21e8d983073f50ade2e924a2fe27ac3b4465635ccc850972bb0
2:40  withdraw                       1febf69ed3b4625b3922a238c74244055c73afab7111454e2180c827bd037441
3:20  clawback                       9b0b4bb01e070952a6f50d5ecafa33db4a4a9b83445283b117136bff45697cbe
3:20  refund to campaign             ecfa74814624cd590eb5d4b5766646c1e378a95fd4fc5266fbe6f55dce106f72
3:45  close_campaign                 d7b07aedcb5071c41d4709ec932d8e95a8db01cefa85374ce4e8b26fbf58f049
```

