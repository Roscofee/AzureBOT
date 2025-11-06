import { PlayerCore } from "../core/PlayerCore";
import { PlayerRepo, PlayerRow } from "../ports/PlayerRepo";
import { MessagePort } from "../ports/MessagePort";

export class PlayerRegisterService {
    constructor(private repo: PlayerRepo, private messages: MessagePort) {}

    async registerPlayer(playerData:{id: number, name: string, nickname: string | undefined} , autoregister: boolean = true) : Promise<PlayerRow | undefined>{

        //Obtain info from database if exists from player id
        let dbPlayerRow = await this.repo.getPlayer(playerData.id);

        //If no player found, call register service, then obatin PlayerRow
        if(!dbPlayerRow){
            await this.repo.registerPlayer(
                playerData.id,
                playerData.name,
                (playerData as any).nickName ?? ""
            );

            dbPlayerRow = await this.repo.getPlayer(playerData.id);
        }

        return dbPlayerRow;

    }
}