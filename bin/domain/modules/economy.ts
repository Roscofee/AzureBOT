import { PlayerCore, PlayerModule } from "../core/PlayerCore";
import { PlayerRepo } from "../ports/PlayerRepo";
import { MessagePort } from "../ports/MessagePort";

export interface EconomyState { currency: number; }
export interface EconomyApi {
  add(amount: number): void;
  spend(amount: number): boolean;
  balance(): number;
}
export type EconomyModule = PlayerModule & EconomyApi & { state: EconomyState };

export function createEconomyModule(initial: number, repo: PlayerRepo, messages: MessagePort): EconomyModule {
  let player: PlayerCore;

  return {
    key: "economy",
    state: { currency: initial },
    onAttach(p) { player = p; },

    add(amount) {
      this.state.currency += amount;
      messages.whisper(player.identity.id, `(Balance updated: ${this.state.currency} ACs)`);
      void repo.updateCurrency(player.identity.id, this.state.currency);
    },

    spend(amount) {
      if (this.state.currency < amount) return false;
      this.state.currency -= amount;
      messages.whisper(player.identity.id, `(Balance updated: ${this.state.currency} ACs)`);
      void repo.updateCurrency(player.identity.id, this.state.currency);
      return true;
    },

    balance() { return this.state.currency; }
  };
}
