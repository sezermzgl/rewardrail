# Games

The offerwall the player sees at `/play`. Five playable games ship here; adding a sixth is one file and one line.

| Game | Studio | Shape |
| --- | --- | --- |
| Coin Rush | Northline Games | Tap coins against a clock, chains multiply |
| Stack Tower | Halcyon Interactive | Timing — overhang is sliced off, the tower narrows |
| Gem Cascade | Bluepeak Studio | Match-and-collapse, bigger runs score superlinearly |
| Reflex Grid | Kestrel Works | Hit the lit tile, three lives, shrinking window |
| Orchard Pairs | Twelvefold | Memory, scored by move count |

All five are click-only and finish in twenty to thirty-five seconds.

## Why these exist

A rewarded-ads pitch with no game in it is an abstraction. The judge hears "player completes a task" and sees a button. These make the earning moment real: someone plays, finishes, and money arrives — which is the entire product in one gesture.

They are deliberately small. The product is the payout rail, not the games, and a game elaborate enough to be interesting would invite the wrong question.

## Adding a game

Write a component that takes `onComplete` and calls it once when the player meets the goal. Build it on `game-shell.tsx` so it looks like it belongs beside the others:

```tsx
'use client';

import { Board, GameHud, Overlay, useClaimOnce } from './game-shell';
import type { GamePlayProps } from './types';

export function TapTheTarget({ onComplete }: GamePlayProps) {
  const claim = useClaimOnce(onComplete);
  return (
    <div className="flex flex-col gap-3">
      <GameHud score={hits} goal={10} accent="var(--blue)" />
      <Board background="linear-gradient(180deg, #123 0%, #012 100%)">
        {/* the board */}
      </Board>
    </div>
  );
}
```

The shell gives you the score readout, the progress bar toward the goal, the win overlay, a countdown, and floating score pops. Five games built independently would drift into five different ideas of what a score looks like, and the offerwall would read as a directory of other people's apps rather than one product.

Then add it to `registry.ts`:

```ts
{
  id: 'tap-the-target',
  title: 'Tap the Target',
  studio: 'Fictional Studio',
  genre: 'Reaction',
  cover: 'linear-gradient(135deg, #2c71f1 0%, #066ffa 100%)',
  goal: 'Hit ten targets',
  art: '🎯',
  seconds: 15,
  Play: TapTheTarget,
}
```

That is the whole integration. Nothing about settlement, the reward payment, the clawback window or the panels changes — a game knows nothing about Stellar, and the payout path is identical for all of them.

## Three rules worth keeping

**Call `onComplete` exactly once.** It settles an action on chain and pays a reward, so a second call pays twice. React runs effects and state updaters more than once under StrictMode, which makes "it only happens on the winning move" unsafe reasoning. `useClaimOnce` from the shell handles it:

```tsx
const claim = useClaimOnce(onComplete);
// ...in an event handler, not an effect:
if (reachedGoal) claim();
```

Every shipped game claims through it.

**Click-only.** A keyboard game is a liability on a projector, and a trackpad is the only input a demo is guaranteed to have. Every game here is playable with one pointer.

**Give it a goal the player can see coming.** `GameHud` takes a score and a goal and draws the bar. A game that just ends is a transaction; a game with a visible finish line is worth the last few taps.

## What the player never sees

The `/play` screen never uses the words wallet, seed, private key, gas, transaction fee or blockchain. That constraint is the visible half of the design claim: a rewarded-ads user is not a crypto user, and any flow asking for wallet setup loses them at step one.

The transaction links on the reward screen are the one exception, and they are labelled as being for verification rather than for the player.
