import { PlayerCore } from "../core/PlayerCore";
import { PlayerRepo } from "../ports/PlayerRepo";
import { MessagePort } from "../ports/MessagePort";

type ClassShopConfig = {
  classPrices?: Partial<Record<number, number>>;
  starterSkillsByClass?: Partial<Record<number, number[]>>;
};

export class ClassShopService {
  constructor(private repo: PlayerRepo, private messages: MessagePort, private shopCfg?: ClassShopConfig) {}

  private calcPrice(classId: number): number {
    return this.shopCfg?.classPrices?.[classId] ?? 1000;
  }

  private async assignStarterSkills(playerId: number, classId: number) {
    const starterSkills = this.shopCfg?.starterSkillsByClass?.[classId] ?? [];
    for (const skillId of starterSkills) {
      await this.repo.assignSkillToPlayer(playerId, skillId);
    }
  }

  /** List classes available for purchase and whisper the shop to the player. */
  async openShop(player: PlayerCore, acceptedClassNames: string[] = []) {
    const economy = player.tryGet<any>("economy");
    if (!economy) {
      this.messages.whisper(player.identity.id, "(ERROR: missing modules)");
      return;
    }

    const items = await this.repo.obtainPlayerClassShop(player.identity.id, acceptedClassNames);
    if (!items || items.length === 0) {
      this.messages.whisper(player.identity.id, "(No classes to purchase!)");
      return;
    }

    const cur = typeof economy.balance === "function" ? economy.balance() : economy.state?.currency;
    let msg = `(\nClasses available for purchase:\n\nUse /bot classShop <class name> to purchase a class.\nUse /bot select <class name> after buying or unlocking a class.\n\nCurrent balance: ${cur} ACs\n\n`;
    for (const it of items) {
      const price = this.calcPrice(it.class_id);
      msg += `|| ${it.class_name}, Price: ${price} Ac ||\n-> ${it.class_description}\n`;
    }
    this.messages.whisper(player.identity.id, msg);
  }

  /** Purchase a class by exact name (case-insensitive). */
  async buy(player: PlayerCore, className: string | undefined, acceptedClassNames: string[] = []) {
    if (!className) {
      this.messages.whisper(player.identity.id, "(ERROR: empty argument)");
      return;
    }

    const economy = player.tryGet<any>("economy");
    if (!economy) {
      this.messages.whisper(player.identity.id, "(ERROR: missing modules)");
      return;
    }

    const items = await this.repo.obtainPlayerClassShop(player.identity.id, acceptedClassNames);
    if (!items || items.length === 0) {
      this.messages.whisper(player.identity.id, "(No classes to purchase!)");
      return;
    }

    const candidate = items.find((c: any) => String(c.class_name).toLowerCase() === String(className).toLowerCase());
    if (!candidate) {
      let aux = "(\nClass not found!\n\nYou must write the exact class name\nYour options are:\n\n";
      for (const c of items) aux += `${c.class_name}\n`;
      this.messages.whisper(player.identity.id, aux);
      return;
    }

    const price = this.calcPrice(candidate.class_id);
    if (!economy.spend(price)) {
      this.messages.whisper(player.identity.id, "(==== \n ERROR: INSUFFICENT FUNDS \n ====");
      return;
    }

    await this.repo.assignClassToPlayer(player.identity.id, candidate.class_id);
    await this.assignStarterSkills(player.identity.id, candidate.class_id);
    this.messages.whisper(player.identity.id, `(==== \n CLASS PURCHASE SUCCESFUL \n You can now select ${candidate.class_name} with /bot select ${candidate.class_name} \n ====)`);
  }
}
