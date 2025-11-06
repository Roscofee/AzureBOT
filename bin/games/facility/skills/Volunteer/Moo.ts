import { PlayerCore } from "../../../../domain/core/PlayerCore";
import { IncomingMessage } from "../../../../domain/ports/MessagePort";
import { Skill, SkillResult, ChatMessageType } from "../../../../domain/skills/Skill.types";


export class Moo implements Skill {
    skillId: number;
    skillName: string;
    skillLevel: number;
    description: string;
    upgrade_description: string;
    
    validMessageTypes: ChatMessageType[] = ["Chat", "Emote"];
    triggerTokens: string[] = ["moo"];
    energyCost: number = 10;
    priority: number = 5;

    constructor(args: {
        skillId: number;
        skillName: string;
        skillLevel: number;
        description: string;
        upgrade_description: string;
    }) {
        this.skillId = args.skillId;
        this.skillName = args.skillName;
        this.skillLevel = args.skillLevel;
        this.description = args.description;
        this.upgrade_description = args.upgrade_description;
    }

    validInput(data: IncomingMessage): boolean {
        if (!this.validMessageTypes.includes(data.Type)) return false;
        const content = (data.Content ?? "").toLowerCase();
        return this.triggerTokens.some(t => content.includes(t));
    }
    canExecute(player: PlayerCore): boolean {
        throw new Error("Method not implemented.");
    }
    use(player: PlayerCore): SkillResult {
        throw new Error("Method not implemented.");
    }
    reset?(): void {
        throw new Error("Method not implemented.");
    }
    
    
}
