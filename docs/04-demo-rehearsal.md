# Demo rehearsal — backup hashes

*One clean run of the eight-step script on Stellar testnet, 2026-09-19 22:10 UTC.*

Every hash below was produced by the same endpoints the panels call, in the
order of the demo script in `01-pitch.md`, and then read back from Horizon to
confirm it resolves and succeeded. If testnet is slow during the presentation,
these are what gets shown — which only works if they are real, so they are
checked rather than copied.

## The run

| | |
| --- | --- |
| Campaign | 5 |
| Escrow | [`CD6HZHGUURVSRWZAODFFLC7JX5WCXZCXHEXOFPXAE5V5ULAD3NDCVTYI`](https://stellar.expert/explorer/testnet/contract/CD6HZHGUURVSRWZAODFFLC7JX5WCXZCXHEXOFPXAE5V5ULAD3NDCVTYI) |
| Payout asset SAC | [`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) |
| Validator key | [`GALJPQWLJVU64BAH46LTRHZML23JF4YDGYBHHCRWOK75IEKSF5QAGR6S`](https://stellar.expert/explorer/testnet/account/GALJPQWLJVU64BAH46LTRHZML23JF4YDGYBHHCRWOK75IEKSF5QAGR6S) |
| Honest player | [`GACRC72RDQ2USMGE26AZB35O74ZAQHBJB3RD44SMAG5ZBUWUCNL5FKR3`](https://stellar.expert/explorer/testnet/account/GACRC72RDQ2USMGE26AZB35O74ZAQHBJB3RD44SMAG5ZBUWUCNL5FKR3) |
| Fraudulent player | [`GBIJFHM6BYO73E3KQRAJI33RRTJBL3TU5J3Z6FN42N2HEBZA5TLIS7TU`](https://stellar.expert/explorer/testnet/account/GBIJFHM6BYO73E3KQRAJI33RRTJBL3TU5J3Z6FN42N2HEBZA5TLIS7TU) |
| Wall clock | 135s, of which 75.2s is the clawback window |
| Transactions | 13, all verified on Horizon |

## Timing against the four-minute script

| Slot | Step | Took | Narration |
| --- | --- | --- | --- |
| 0:40 | Campaign opening | 5.2s | The budget is locked in a contract, not held by us. |
| 1:10 | Player signup | 9.4s | An email and nothing else. No wallet, no seed, no XLM. |
| 1:40 | Task completion | 20s | One verified action, three shares, one transaction. |
| 2:10 | Instant withdrawal | 75.2s | No threshold. The fee is a rounding error against the reward. |
| 2:40 | Publisher withdrawal | 4.5s | Accrued per action, withdrawn on demand, no minimum. |
| 3:00 | Cash out | 5.3s | The anchor's own KYC page, not ours. |
| 3:20 | Fraud scenario | 10.1s | The reward comes back. The honest player is untouched. |
| 3:45 | Campaign closing | 5.2s | Unspent budget goes back to the advertiser, by contract. |

## The hashes

### 0:40 — Campaign opening

- campaign 5, 12 USDC at 4 per action

| What | Transaction |
| --- | --- |
| open_campaign | [`38bf952e19d1f010…`](https://stellar.expert/explorer/testnet/tx/38bf952e19d1f010d4ab755635641591e1a42a9528a1d037e2b016d3b6b55167) |

### 1:10 — Player signup

- honest GACRC72RDQ2USMGE26AZB35O74ZAQHBJB3RD44SMAG5ZBUWUCNL5FKR3
- fraudster GBIJFHM6BYO73E3KQRAJI33RRTJBL3TU5J3Z6FN42N2HEBZA5TLIS7TU

| What | Transaction |
| --- | --- |
| sponsored account (honest) | [`121b5a008310e884…`](https://stellar.expert/explorer/testnet/tx/121b5a008310e884173a8a7fe2729b51dfed754bc7dcc616c1076cf31bd15082) |
| sponsored account (fraudster) | [`e68cf6b20d480412…`](https://stellar.expert/explorer/testnet/tx/e68cf6b20d480412da59e6a95948f7dac32958f3da2a4945515fc3b7f056ad27) |

### 1:40 — Task completion

- each credited 1.2000000

| What | Transaction |
| --- | --- |
| settle (honest) | [`3728ae2a6c7b700d…`](https://stellar.expert/explorer/testnet/tx/3728ae2a6c7b700d1460d8548044835a1cdfe64e7d44577fadf7bc109af8e970) |
| REWARD paid (honest) | [`1f463b489b76d99d…`](https://stellar.expert/explorer/testnet/tx/1f463b489b76d99d7c4f63a9d54cce95881ca8ac5cca3b56f809158d20f4d233) |
| settle (fraudster) | [`ea05672e2ec568b2…`](https://stellar.expert/explorer/testnet/tx/ea05672e2ec568b20111e7e95470f67f81bf796093b623369eb1ef60fe177910) |
| REWARD paid (fraudster) | [`e8140e1d53a0089b…`](https://stellar.expert/explorer/testnet/tx/e8140e1d53a0089b3948a68eed510b22fbfa22892934ee1b1cbe123cb1f7ec3c) |

### 2:10 — Instant withdrawal

- waiting out the 60s clawback window — a new account, so the reward is frozen
- 1.2000000 USDC now the player's, unreversible

| What | Transaction |
| --- | --- |
| REWARD burned | [`294f0982a18b52ba…`](https://stellar.expert/explorer/testnet/tx/294f0982a18b52babf46a0d839190bff3464ffe7cd2f3c21bb3edd42a5b91fa3) |
| payout withdrawn | [`5d66aca67ff685c4…`](https://stellar.expert/explorer/testnet/tx/5d66aca67ff685c49990e7c2963c506d58adfde2ae520b1b3c23ab210cd6e380) |

### 2:40 — Publisher withdrawal

- 3.6000000 USDC out of escrow

| What | Transaction |
| --- | --- |
| withdraw | [`9beb1a33a79b4e7c…`](https://stellar.expert/explorer/testnet/tx/9beb1a33a79b4e7cc71f15d911ac16f870d68eb9c4e4134dd300fe5b20364868) |

### 3:00 — Cash out

- anchor transaction `sep_1fonyo3zuss9ufu9zzin`
- no interactive URL: this anchor is SEP-6, which has no hosted page

No chain transaction of ours. The withdrawal is opened on the anchor's
server and the payment leaves when the anchor is satisfied, which is the
point — the payout details never reach us.

### 3:20 — Fraud scenario

- 1.2000000 REWARD reversed
- honest player: player already converted — the payout is theirs, the window had closed

| What | Transaction |
| --- | --- |
| clawback | [`2c036d0e88dcf044…`](https://stellar.expert/explorer/testnet/tx/2c036d0e88dcf044becc437c389fdd4e451fe9a923d04a0dbaee48a49de27711) |
| refund to campaign | [`cc58e0cb2cef96ad…`](https://stellar.expert/explorer/testnet/tx/cc58e0cb2cef96adeefbd4e94420c8da4efd0be7d196f742e81f914d430d9926) |

### 3:45 — Campaign closing

- 5.2000000 USDC refunded

| What | Transaction |
| --- | --- |
| close_campaign | [`4187621fa482de60…`](https://stellar.expert/explorer/testnet/tx/4187621fa482de60f8dd7f336253ba0abce609eccd0bdfdd612bb0c0a1473c61) |

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

The eight steps were driven against a locally running validator through the
same HTTP endpoints the panels call, in the order of the table in
`01-pitch.md`, and every hash was then read back from Horizon to confirm it
resolved and succeeded. Re-running it produces a new campaign and new player
accounts; nothing here is reused.

## Tabs to open before presenting

In this order, so the narrative never waits on a search box.

1. The console itself — `/demo`
2. Escrow contract — https://stellar.expert/explorer/testnet/contract/CD6HZHGUURVSRWZAODFFLC7JX5WCXZCXHEXOFPXAE5V5ULAD3NDCVTYI
3. Honest player — https://stellar.expert/explorer/testnet/account/GACRC72RDQ2USMGE26AZB35O74ZAQHBJB3RD44SMAG5ZBUWUCNL5FKR3
4. Fraudulent player — https://stellar.expert/explorer/testnet/account/GBIJFHM6BYO73E3KQRAJI33RRTJBL3TU5J3Z6FN42N2HEBZA5TLIS7TU
5. 0:40 open_campaign — https://stellar.expert/explorer/testnet/tx/38bf952e19d1f010d4ab755635641591e1a42a9528a1d037e2b016d3b6b55167
6. 1:10 sponsored account (honest) — https://stellar.expert/explorer/testnet/tx/121b5a008310e884173a8a7fe2729b51dfed754bc7dcc616c1076cf31bd15082
7. 1:10 sponsored account (fraudster) — https://stellar.expert/explorer/testnet/tx/e68cf6b20d480412da59e6a95948f7dac32958f3da2a4945515fc3b7f056ad27
8. 1:40 settle (honest) — https://stellar.expert/explorer/testnet/tx/3728ae2a6c7b700d1460d8548044835a1cdfe64e7d44577fadf7bc109af8e970
9. 1:40 REWARD paid (honest) — https://stellar.expert/explorer/testnet/tx/1f463b489b76d99d7c4f63a9d54cce95881ca8ac5cca3b56f809158d20f4d233
10. 1:40 settle (fraudster) — https://stellar.expert/explorer/testnet/tx/ea05672e2ec568b20111e7e95470f67f81bf796093b623369eb1ef60fe177910
11. 1:40 REWARD paid (fraudster) — https://stellar.expert/explorer/testnet/tx/e8140e1d53a0089b3948a68eed510b22fbfa22892934ee1b1cbe123cb1f7ec3c
12. 2:10 REWARD burned — https://stellar.expert/explorer/testnet/tx/294f0982a18b52babf46a0d839190bff3464ffe7cd2f3c21bb3edd42a5b91fa3
13. 2:10 payout withdrawn — https://stellar.expert/explorer/testnet/tx/5d66aca67ff685c49990e7c2963c506d58adfde2ae520b1b3c23ab210cd6e380
14. 2:40 withdraw — https://stellar.expert/explorer/testnet/tx/9beb1a33a79b4e7cc71f15d911ac16f870d68eb9c4e4134dd300fe5b20364868
15. 3:20 clawback — https://stellar.expert/explorer/testnet/tx/2c036d0e88dcf044becc437c389fdd4e451fe9a923d04a0dbaee48a49de27711
16. 3:20 refund to campaign — https://stellar.expert/explorer/testnet/tx/cc58e0cb2cef96adeefbd4e94420c8da4efd0be7d196f742e81f914d430d9926
17. 3:45 close_campaign — https://stellar.expert/explorer/testnet/tx/4187621fa482de60f8dd7f336253ba0abce609eccd0bdfdd612bb0c0a1473c61

## Full hashes

For copying into a terminal or a search box when a link is not to hand.

```
0:40  open_campaign                  38bf952e19d1f010d4ab755635641591e1a42a9528a1d037e2b016d3b6b55167
1:10  sponsored account (honest)     121b5a008310e884173a8a7fe2729b51dfed754bc7dcc616c1076cf31bd15082
1:10  sponsored account (fraudster)  e68cf6b20d480412da59e6a95948f7dac32958f3da2a4945515fc3b7f056ad27
1:40  settle (honest)                3728ae2a6c7b700d1460d8548044835a1cdfe64e7d44577fadf7bc109af8e970
1:40  REWARD paid (honest)           1f463b489b76d99d7c4f63a9d54cce95881ca8ac5cca3b56f809158d20f4d233
1:40  settle (fraudster)             ea05672e2ec568b20111e7e95470f67f81bf796093b623369eb1ef60fe177910
1:40  REWARD paid (fraudster)        e8140e1d53a0089b3948a68eed510b22fbfa22892934ee1b1cbe123cb1f7ec3c
2:10  REWARD burned                  294f0982a18b52babf46a0d839190bff3464ffe7cd2f3c21bb3edd42a5b91fa3
2:10  payout withdrawn               5d66aca67ff685c49990e7c2963c506d58adfde2ae520b1b3c23ab210cd6e380
2:40  withdraw                       9beb1a33a79b4e7cc71f15d911ac16f870d68eb9c4e4134dd300fe5b20364868
3:20  clawback                       2c036d0e88dcf044becc437c389fdd4e451fe9a923d04a0dbaee48a49de27711
3:20  refund to campaign             cc58e0cb2cef96adeefbd4e94420c8da4efd0be7d196f742e81f914d430d9926
3:45  close_campaign                 4187621fa482de60f8dd7f336253ba0abce609eccd0bdfdd612bb0c0a1473c61
```

