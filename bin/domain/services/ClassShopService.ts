import { PlayerCore } from "../core/PlayerCore";
import { PlayerRepo } from "../ports/PlayerRepo";
import { MessagePort } from "../ports/MessagePort";

export class ClassShopService {
  constructor(private repo: PlayerRepo, private messages: MessagePort) {}

  /** List classes available for purchase and whisper the shop to the player. */
  async openShop(player: PlayerCore, acceptedClassNames: string[] = []) {
    const items = await this.repo.obtainPlayerClassShop(player.identity.id, acceptedClassNames);
    if (!items || items.length === 0) {
      this.messages.whisper(player.identity.id, "(No classes to purchase!)");
      return;
    }

    let msg = "(Classes available for purchase:\n";
    for (const it of items) {
      msg += `|| ${it.class_name}, Price: 1000 Ac ||\n-> ${it.class_description}\n`;
    }
    this.messages.whisper(player.identity.id, msg);
  }
}

