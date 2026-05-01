import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { SongModule } from "../../../../domain/modules/song";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { ChatMessageType, Skill, SkillResult } from "../../../../domain/skills/Skill.types";
import { songEngine } from "../../../../domain/services/facility/SongEngine";
import { currentEnergyPercentCost } from "./_shared";

export class Encore implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;

    validMessageTypes: ChatMessageType[] = ["Emote"];
    triggerTokens: string[] = ["encore", "encores"];
    energyCost = 0;
    priority = 14;

    constructor(args: { skillId: number; skillName: string; skillLevel: number; description: string; upgrade_description: string; }) {
        this.skillId = args.skillId;
        this.skillName = args.skillName;
        this.skillLevel = args.skillLevel;
        this.description = args.description;
        this.upgrade_description = args.upgrade_description;
    }

    validInput(data: IncomingMessage): boolean {
        const content = (data.Content ?? "").toLowerCase();
        return this.validMessageTypes.includes(data.Type) && this.triggerTokens.some((token) => content.includes(token));
    }

    canExecute(player: PlayerCore): boolean {
        const song = player.tryGet<SongModule>("song");
        return song?.state.lastPlayedSong != null;
    }

    computeEnergy(player: PlayerCore): number {
        return currentEnergyPercentCost(player, 1.0, 0.9, this.skillLevel);
    }

    use(player: PlayerCore): SkillResult {
        const phrase = songEngine.performEncoreSong(player);
        return { energy: this.computeEnergy(player), reward: 0, effects: phrase.effects, feedback: phrase.feedback };
    }
}
