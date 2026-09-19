/**
 * The contract every game in the offerwall implements.
 *
 * A game knows nothing about Stellar, rewards or the validator. It plays, and
 * when the player reaches the goal it calls `onComplete` once. Everything that
 * follows — settling on chain, paying the reward, freezing it for the clawback
 * window — happens outside the game and is the same for all of them.
 *
 * That separation is the point. Adding a game is writing a component that
 * takes `onComplete` and registering it; nothing about the payout changes.
 */
export type GamePlayProps = {
  /** Call once, when the player has met the goal. */
  onComplete: () => void;
};

export type Game = {
  /** Stable id. Used in URLs and as a React key, so do not rename casually. */
  id: string;
  title: string;
  /** The fictional developer, so the offerwall reads like a real one. */
  studio: string;
  /** One line the player sees before starting. */
  goal: string;
  /** Emoji stands in for cover art we are not going to draw. */
  art: string;
  /** Roughly how long a run takes, in seconds. Shown in the offerwall. */
  seconds: number;
  Play: React.ComponentType<GamePlayProps>;
};
