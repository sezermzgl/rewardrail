# Games

The offerwall the player sees at `/play`. Two playable games ship here; adding a third is one file and one line.

## Why these exist

A rewarded-ads pitch with no game in it is an abstraction. The judge hears "player completes a task" and sees a button. These make the earning moment real: someone plays, finishes, and money arrives — which is the entire product in one gesture.

They are deliberately small. The product is the payout rail, not the games, and a game elaborate enough to be interesting would invite the wrong question.

## Adding a game

Write a component that takes `onComplete` and calls it once when the player meets the goal:

```tsx
'use client';

import type { GamePlayProps } from './types';

export function TapTheTarget({ onComplete }: GamePlayProps) {
  return <button onClick={onComplete}>Finish</button>;
}
```

Then add it to `registry.ts`:

```ts
{
  id: 'tap-the-target',
  title: 'Tap the Target',
  studio: 'Fictional Studio',
  goal: 'Hit ten targets',
  art: '🎯',
  seconds: 15,
  Play: TapTheTarget,
}
```

That is the whole integration. Nothing about settlement, the reward payment, the clawback window or the panels changes — a game knows nothing about Stellar, and the payout path is identical for all of them.

## Two rules worth keeping

**Call `onComplete` exactly once.** It settles an action on chain and pays a reward, so a second call pays twice. React runs effects and state updaters more than once under StrictMode, so guard with a ref set in an event handler rather than relying on an effect firing once:

```tsx
const claimed = useRef(false);
if (reachedGoal && !claimed.current) {
  claimed.current = true;
  onComplete();
}
```

Both shipped games do this, for the reason written in their comments.

**Click-only.** A keyboard game is a liability on a projector, and a trackpad is the only input a demo is guaranteed to have. Both games here are playable with one pointer.

## What the player never sees

The `/play` screen never uses the words wallet, seed, private key, gas, transaction fee or blockchain. That constraint is the visible half of the design claim: a rewarded-ads user is not a crypto user, and any flow asking for wallet setup loses them at step one.

The transaction links on the reward screen are the one exception, and they are labelled as being for verification rather than for the player.
