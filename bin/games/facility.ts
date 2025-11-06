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
import { DomainEventAdapter, MessageAdapter, MessageRouter } from "../adapters/messages";
import { DBAdapter } from "../adapters/db/DBAdapter";
import { PlayerRepo } from "../domain/ports/PlayerRepo";
import { MessagePort, IncomingMessage } from "../domain/ports/MessagePort";
import { DomainEventBus } from "../domain/ports/DomainEvenPort";
import _ from "lodash";

const listOfUsedItems: ([AssetGroupName, string] | [AssetGroupName, string, string])[] = [
    ["ItemDevices", "Paddle"],
    ["ItemMouth", "DusterGag"],
    ["ItemArms", "LeatherArmbinder", "WrapStrap"],
    ["ItemMouth", "BallGag", "Shiny"],
    ["ItemMisc", "ServingTray"]
];

const listOfUsedItemGroups = _.uniq(listOfUsedItems.map(i => i[0]));


export class Facility{

    private repo: PlayerRepo;
    private bus: DomainEventBus;
    private messages: MessagePort;
    private router : MessageRouter;

    public constructor(conn: API_Connector){

        this.repo = new DBAdapter();
        this.bus = new DomainEventAdapter(conn);
        this.messages = new MessageAdapter(conn);
        this.router = new MessageRouter(this.bus, this.repo, this.messages);

        conn.on("Message", this.onMessage);


    }

    private onMessage = async (msg: API_Message) => {
        
        if(msg.message.Type === "Emote"){
            
            //Legacy code here, at this point this is just trademark
            //Farm entry point
            if(msg.message.Content.includes("scanner")){

                //Check if player is valid for the game

                

            }

        }
        
        if(msg.message.Type === "Chat"){

        }
    }

    private async validCharacter(character: API_Character){

        //Check permission level
        const allow = await character.GetAllowItem();

        //Check chest type

        //Check item permission

    }

}
