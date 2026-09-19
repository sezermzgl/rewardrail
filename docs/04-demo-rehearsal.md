# Demo rehearsal — backup hashes

*One clean run of the eight-step script on Stellar testnet, 2026-09-19 22:22 UTC.*

Every hash below was produced by the same endpoints the panels call, in the
order of the demo script in `01-pitch.md`, and then read back from Horizon to
confirm it resolves and succeeded. If testnet is slow during the presentation,
these are what gets shown — which only works if they are real, so they are
checked rather than copied.

## The run

| | |
| --- | --- |
| Campaign | 6 |
| Escrow | [`CD6HZHGUURVSRWZAODFFLC7JX5WCXZCXHEXOFPXAE5V5ULAD3NDCVTYI`](https://stellar.expert/explorer/testnet/contract/CD6HZHGUURVSRWZAODFFLC7JX5WCXZCXHEXOFPXAE5V5ULAD3NDCVTYI) |
| Payout asset SAC | [`CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) |
| Validator key | [`GALJPQWLJVU64BAH46LTRHZML23JF4YDGYBHHCRWOK75IEKSF5QAGR6S`](https://stellar.expert/explorer/testnet/account/GALJPQWLJVU64BAH46LTRHZML23JF4YDGYBHHCRWOK75IEKSF5QAGR6S) |
| Honest player | [`GCGTJXCPWZR7JIYTPYMLQT2WKLDDTQ3FVICPKNPJEDDJKU4CKLN4ZPUL`](https://stellar.expert/explorer/testnet/account/GCGTJXCPWZR7JIYTPYMLQT2WKLDDTQ3FVICPKNPJEDDJKU4CKLN4ZPUL) |
| Fraudulent player | [`GDVZZS2LU5SMWPIQJQLEQULAYM5TY4GQCSKU5QBMIXREVL4NWRTPN4XB`](https://stellar.expert/explorer/testnet/account/GDVZZS2LU5SMWPIQJQLEQULAYM5TY4GQCSKU5QBMIXREVL4NWRTPN4XB) |
| Wall clock | 138.2s, of which 75.4s is the clawback window |
| Transactions | 13, all verified on Horizon |

## Timing against the four-minute script

| Slot | Step | Took | Narration |
| --- | --- | --- | --- |
| 0:40 | Campaign opening | 8.6s | The budget is locked in a contract, not held by us. |
| 1:10 | Player signup | 9.6s | An email and nothing else. No wallet, no seed, no XLM. |
| 1:40 | Task completion | 19.6s | One verified action, three shares, one transaction. |
| 2:10 | Instant withdrawal | 75.4s | No threshold. The fee is a rounding error against the reward. |
| 2:40 | Publisher withdrawal | 4.6s | Accrued per action, withdrawn on demand, no minimum. |
| 3:00 | Cash out | 5.5s | The anchor confirms the payout, and the bank details never reach us. |
| 3:20 | Fraud scenario | 9.7s | The reward comes back. The honest player is untouched. |
| 3:45 | Campaign closing | 5.3s | Unspent budget goes back to the advertiser, by contract. |

## The hashes

### 0:40 — Campaign opening

- campaign 6, 12 USDC at 4 per action

| What | Transaction |
| --- | --- |
| open_campaign | [`8b8b9719f7cb1761…`](https://stellar.expert/explorer/testnet/tx/8b8b9719f7cb176196aa3ec95193a9739be7c3c8b9def9b37b5f3cebf9de25e9) |

### 1:10 — Player signup

- honest GCGTJXCPWZR7JIYTPYMLQT2WKLDDTQ3FVICPKNPJEDDJKU4CKLN4ZPUL
- fraudster GDVZZS2LU5SMWPIQJQLEQULAYM5TY4GQCSKU5QBMIXREVL4NWRTPN4XB

| What | Transaction |
| --- | --- |
| sponsored account (honest) | [`289fdada451b032a…`](https://stellar.expert/explorer/testnet/tx/289fdada451b032ac6f74a73caac4458c38eb6627d157d57de8f16e25b987c2f) |
| sponsored account (fraudster) | [`97e895370070e864…`](https://stellar.expert/explorer/testnet/tx/97e895370070e864fa79be31026e5b3099ae396207a2f307098cebc34529b3bd) |

### 1:40 — Task completion

- each credited 1.2000000

| What | Transaction |
| --- | --- |
| settle (honest) | [`401b57d6a36e1740…`](https://stellar.expert/explorer/testnet/tx/401b57d6a36e1740d50c4adc9c12e53e7d8f2fdca0ee604d57b029a75ebce696) |
| REWARD paid (honest) | [`ff95f6ce1eec01a3…`](https://stellar.expert/explorer/testnet/tx/ff95f6ce1eec01a33755e5dfa6a428d10cfe0400e26d54245558bdf1333d2b47) |
| settle (fraudster) | [`12c6bab75e47807a…`](https://stellar.expert/explorer/testnet/tx/12c6bab75e47807a98dadd554a4b21b898e7aa3afe46ca425fdae1b0f16a1b5a) |
| REWARD paid (fraudster) | [`dbfad5e14f528d0b…`](https://stellar.expert/explorer/testnet/tx/dbfad5e14f528d0bc3d415cb284ff93b3ba8943888677e224d0a20e9e72abf29) |

### 2:10 — Instant withdrawal

- waiting out the 60s clawback window — a new account, so the reward is frozen
- 1.2000000 USDC now the player's, unreversible

| What | Transaction |
| --- | --- |
| REWARD burned | [`90fca40ec7c41501…`](https://stellar.expert/explorer/testnet/tx/90fca40ec7c415016bff6f4b38f2966351bb9f17cb2fc4893a7395e9737919c8) |
| payout withdrawn | [`12dba97271f3e36b…`](https://stellar.expert/explorer/testnet/tx/12dba97271f3e36b65f9e3d67a3b6492dd45de2966b94052c5c374d3fd0dd8a7) |

### 2:40 — Publisher withdrawal

- 3.6000000 USDC out of escrow

| What | Transaction |
| --- | --- |
| withdraw | [`89860a26e7abba5c…`](https://stellar.expert/explorer/testnet/tx/89860a26e7abba5cb43f97e65038a7e5e16cfb3b73534ed7d683a8ecbedb2f1c) |

### 3:00 — Cash out

- anchor transaction `sep_ueruomhrjd3qqgwzmikx`
- no interactive URL: this anchor is SEP-6, which has no hosted page

No chain transaction of ours. The withdrawal is opened on the anchor's
server and the payment leaves when the anchor is satisfied, which is the
point — the payout details never reach us.

### 3:20 — Fraud scenario

- 1.2000000 REWARD reversed
- honest player: player already converted — the payout is theirs, the window had closed

| What | Transaction |
| --- | --- |
| clawback | [`dab6a1d23c12d600…`](https://stellar.expert/explorer/testnet/tx/dab6a1d23c12d600accb3395f7e94cf59a53eaf84ccda59394cf4d59404eeff6) |
| refund to campaign | [`2ba2a7f315b547b0…`](https://stellar.expert/explorer/testnet/tx/2ba2a7f315b547b0d399185bc05b84449cf75e27714d50626b9d5ed26be1eb40) |

### 3:45 — Campaign closing

- 5.2000000 USDC refunded

| What | Transaction |
| --- | --- |
| close_campaign | [`345e4aab10b72bac…`](https://stellar.expert/explorer/testnet/tx/345e4aab10b72bac9dac8b28a3f416088a8f591900104677dbbbd2fec4cabb18) |

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
3. Honest player — https://stellar.expert/explorer/testnet/account/GCGTJXCPWZR7JIYTPYMLQT2WKLDDTQ3FVICPKNPJEDDJKU4CKLN4ZPUL
4. Fraudulent player — https://stellar.expert/explorer/testnet/account/GDVZZS2LU5SMWPIQJQLEQULAYM5TY4GQCSKU5QBMIXREVL4NWRTPN4XB
5. 0:40 open_campaign — https://stellar.expert/explorer/testnet/tx/8b8b9719f7cb176196aa3ec95193a9739be7c3c8b9def9b37b5f3cebf9de25e9
6. 1:10 sponsored account (honest) — https://stellar.expert/explorer/testnet/tx/289fdada451b032ac6f74a73caac4458c38eb6627d157d57de8f16e25b987c2f
7. 1:10 sponsored account (fraudster) — https://stellar.expert/explorer/testnet/tx/97e895370070e864fa79be31026e5b3099ae396207a2f307098cebc34529b3bd
8. 1:40 settle (honest) — https://stellar.expert/explorer/testnet/tx/401b57d6a36e1740d50c4adc9c12e53e7d8f2fdca0ee604d57b029a75ebce696
9. 1:40 REWARD paid (honest) — https://stellar.expert/explorer/testnet/tx/ff95f6ce1eec01a33755e5dfa6a428d10cfe0400e26d54245558bdf1333d2b47
10. 1:40 settle (fraudster) — https://stellar.expert/explorer/testnet/tx/12c6bab75e47807a98dadd554a4b21b898e7aa3afe46ca425fdae1b0f16a1b5a
11. 1:40 REWARD paid (fraudster) — https://stellar.expert/explorer/testnet/tx/dbfad5e14f528d0bc3d415cb284ff93b3ba8943888677e224d0a20e9e72abf29
12. 2:10 REWARD burned — https://stellar.expert/explorer/testnet/tx/90fca40ec7c415016bff6f4b38f2966351bb9f17cb2fc4893a7395e9737919c8
13. 2:10 payout withdrawn — https://stellar.expert/explorer/testnet/tx/12dba97271f3e36b65f9e3d67a3b6492dd45de2966b94052c5c374d3fd0dd8a7
14. 2:40 withdraw — https://stellar.expert/explorer/testnet/tx/89860a26e7abba5cb43f97e65038a7e5e16cfb3b73534ed7d683a8ecbedb2f1c
15. 3:20 clawback — https://stellar.expert/explorer/testnet/tx/dab6a1d23c12d600accb3395f7e94cf59a53eaf84ccda59394cf4d59404eeff6
16. 3:20 refund to campaign — https://stellar.expert/explorer/testnet/tx/2ba2a7f315b547b0d399185bc05b84449cf75e27714d50626b9d5ed26be1eb40
17. 3:45 close_campaign — https://stellar.expert/explorer/testnet/tx/345e4aab10b72bac9dac8b28a3f416088a8f591900104677dbbbd2fec4cabb18

## Full hashes

For copying into a terminal or a search box when a link is not to hand.

```
0:40  open_campaign                  8b8b9719f7cb176196aa3ec95193a9739be7c3c8b9def9b37b5f3cebf9de25e9
1:10  sponsored account (honest)     289fdada451b032ac6f74a73caac4458c38eb6627d157d57de8f16e25b987c2f
1:10  sponsored account (fraudster)  97e895370070e864fa79be31026e5b3099ae396207a2f307098cebc34529b3bd
1:40  settle (honest)                401b57d6a36e1740d50c4adc9c12e53e7d8f2fdca0ee604d57b029a75ebce696
1:40  REWARD paid (honest)           ff95f6ce1eec01a33755e5dfa6a428d10cfe0400e26d54245558bdf1333d2b47
1:40  settle (fraudster)             12c6bab75e47807a98dadd554a4b21b898e7aa3afe46ca425fdae1b0f16a1b5a
1:40  REWARD paid (fraudster)        dbfad5e14f528d0bc3d415cb284ff93b3ba8943888677e224d0a20e9e72abf29
2:10  REWARD burned                  90fca40ec7c415016bff6f4b38f2966351bb9f17cb2fc4893a7395e9737919c8
2:10  payout withdrawn               12dba97271f3e36b65f9e3d67a3b6492dd45de2966b94052c5c374d3fd0dd8a7
2:40  withdraw                       89860a26e7abba5cb43f97e65038a7e5e16cfb3b73534ed7d683a8ecbedb2f1c
3:20  clawback                       dab6a1d23c12d600accb3395f7e94cf59a53eaf84ccda59394cf4d59404eeff6
3:20  refund to campaign             2ba2a7f315b547b0d399185bc05b84449cf75e27714d50626b9d5ed26be1eb40
3:45  close_campaign                 345e4aab10b72bac9dac8b28a3f416088a8f591900104677dbbbd2fec4cabb18
```

