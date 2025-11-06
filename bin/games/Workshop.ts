
import { decompressFromBase64 } from "lz-string";
import {
    API_Connector,
    API_Message,
    makeDoorRegion,
    MapRegion,
    API_Character,
    AssetGet,
    BC_AppearanceItem,
    CommandParser,
    BC_Server_ChatRoomMessage,
    API_Map,
} from "bc-bot";
import { remainingTimeString } from "../utils";
import { wait } from "../hub/utils";

export class WorkShop {
    public constructor(private conn: API_Connector){
        conn.on("Message", this.onMessage);
    }

    private onMessage = async (msg: API_Message) => {
        console.log(msg.message);
        console.log(msg.sender.MapPos);
    }


}