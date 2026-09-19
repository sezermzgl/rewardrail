/** Shapes the escrow returns, after `scValToNative` has decoded them. */

export interface Split {
  player_bps: number;
  publisher_bps: number;
  platform_bps: number;
}

/** A campaign as the contract stores it. Amounts arrive as stroops. */
export interface Campaign {
  advertiser: string;
  platform: string;
  token: string;
  validator: Uint8Array;
  per_action: bigint;
  remaining: bigint;
  /** publisher address -> ratio. `scValToNative` decodes a Soroban Map as a
   *  plain object, not a JS Map. */
  splits: Record<string, Split>;
  open: boolean;
}

/** What the advertiser panel renders: the campaign, in display units. */
export interface CampaignView {
  id: number;
  advertiser: string;
  platform: string;
  open: boolean;
  perAction: string;
  /** Budget not yet released by a settle. Per campaign. */
  remaining: string;
  /**
   * TUSDC the escrow contract holds, across EVERY campaign.
   *
   * One contract carries all campaigns, so this is not campaign 0's escrow.
   * Neither a per-campaign balance nor a per-campaign spend can be read from
   * chain state, because `open_campaign` keeps `remaining` and discards the
   * budget it was opened with. See docs/03-contract-interface.md, F4.
   */
  escrowTotalBalance: string;
  splits: Array<{ publisher: string } & Split>;
}
