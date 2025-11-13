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
import { buildDairyPlayer, DairyFlags } from "./facility/buildPlayer";
import { SkillEngine } from "../domain/services/SkillEngine";
import { ClassSelectionService } from "../domain/services/ClassSelectionService";
import { PlayerRegisterService } from "../domain/services/PlayerGameRegistrationService";
import { PlayerFor } from "../domain/core/game-schema";
import { FacilitySchema } from "./facility/schema";
import { acceptedClassNames, FacilityClasses, FacilityConfig, FacilityEvents } from "./facility/config";
import _ from "lodash";
import { dialog } from "../dialog/dialog";
// Ensure Facility skills are registered at startup (side-effect import)
import "./facility/skills/indext";
import { SkillsModule } from "../domain/modules/skills";
import { ClassingModule } from "../domain/modules/classing";
import { FlagsModule } from "../domain/modules/flags";

/**
 * Player type definition for this game, uses the configured schema
 */
type DairyPlayer = PlayerFor<typeof FacilitySchema>;

const listOfUsedItems: ([AssetGroupName, string] | [AssetGroupName, string, string])[] = [
    ["ItemDevices", "LactationPump"],
    ["ItemMouth", "DusterGag"],
    ["ItemArms", "LeatherArmbinder", "WrapStrap" ],
    ["ItemMouth", "BallGag", "Shiny"],
    ["ItemMisc", "ServingTray"]
];

const listOfUsedItemGroups = _.uniq(listOfUsedItems.map(i => i[0]));


export class Facility{

    private repo: PlayerRepo;
    private bus: DomainEventBus;
    private messages: MessagePort;
    private router : MessageRouter;
    private commandParser : CommandParser;
    private dbRegisterService: PlayerRegisterService;
    private selectClassService: ClassSelectionService;

    /**
     * Shift in progress flag, false when a shift is finished
     */
    private shiftInProgress: boolean = false;

    /**
     * Farm open flag, false when farm is closed
     */
    private farmOpen: boolean = false;

    public constructor(private conn: API_Connector){

        this.repo = new DBAdapter();
        this.bus = new DomainEventAdapter(conn);
        this.messages = new MessageAdapter(conn);
        // Bridge game event topics to the MessagePort adapter
        this.bus.subscribe(FacilityEvents.message.whisper, (evt) => {
            try {
                const p = evt.payload as { playerId: number; text: string };
                if (typeof p?.playerId === "number" && typeof p?.text === "string") {
                    this.messages.whisper(p.playerId, p.text);
                }
            } catch { /* ignore malformed event */ }
        });
        this.bus.subscribe(FacilityEvents.message.broadcast, (evt) => {
            try {
                const p = evt.payload as { text: string };
                if (typeof p?.text === "string") {
                    this.messages.broadcast(p.text);
                }
            } catch { /* ignore malformed event */ }
        });
        const engine = new SkillEngine();

        this.router = new MessageRouter(
            this.bus,
            this.repo,
            this.messages,
            {
                buildPlayer: async (identity, deps) => {
                    const row = await this.repo.getPlayer(identity.id);
                    const fallback = {
                        id: identity.id,
                        name: identity.name,
                        nickname: identity.nickname ?? null,
                        currency: 0,
                        regular: false,
                        superadmin: false,
                        creation_date: new Date().toISOString(),
                    } as any;
                    return buildDairyPlayer(identity, deps as any, (row ?? fallback) as any);
                },
                onTextMessage: async (player, incoming) => {
                    if(this.farmOpen && this.shiftInProgress && player.get<FlagsModule<DairyFlags>>("flags").get("active")){
                        const text = (incoming.Content ?? "").trim();
                        const result = engine.processToken(player, incoming);
                        if (result && result !== "NonSkill") {
                            this.messages.whisper(player.identity.id, result);
                        }
                    }
                }
            }
        );
        this.dbRegisterService = new PlayerRegisterService(this.repo, this.messages);
        this.selectClassService = new ClassSelectionService(this.repo, this.messages, FacilityConfig);

        this.commandParser = new CommandParser(conn);

        //Room commands definition
        //Class selection/info display
        this.commandParser.register("select", this.onCommandSelect);
        this.commandParser.register("class", this.onCommandClass);
        this.commandParser.register("skills", this.onCommandSkills);   

        conn.on("Message", this.onMessage);


    }

    private onMessage = async (msg: API_Message) => {
        
        if(msg.message.Type === "Emote"){
            
            //Legacy code here, at this point this is just trademark
            //Farm entry point
            if(msg.message.Content.includes("scanner")){

                const id = msg.sender.MemberNumber;
                const name = msg.sender.Name;
                const nickname = msg.sender.NickName;

                //Check if player is valid for the game

                const valid = await this.validCharacter(msg.sender);

                //If player not valid, do nothing
                if(!valid){return;}
                
                //Check if the player already exists
                //If they do just notify the player and do nothing
                const alreadyIn = this.router.get(id);

                if(alreadyIn){

                    console.log(`WARNING: player ${alreadyIn.getName()} already in dictionary for this session`)

                    this.messages.whisper(id, dialog.error.alredyIn);
                    return;
                }

                //Obtain player from database or register a new one
                //Either way we get an object with player info from DB
                const dbAccount = await this.dbRegisterService.registerPlayer({id, name, nickname});

                //If no playerInfo object is found, finish, raise error and inform player
                if(!dbAccount){
                    console.log(`ERROR, player ${nickname || name} database account not found and row not created`);
                    return;
                }
                
                //Build player type with no class using the retrieved info
                const player : DairyPlayer = buildDairyPlayer({id, name, nickname}, {repo: this.repo, messages: this.messages, bus: this.bus}, dbAccount);

                // Register player in the centralized router cache
                this.router.register(player);
                console.log(`Player ${player.getName()} successfully registered in router cache`);

                //Retrieve player class list
                let playerClasses = await this.repo.obtainPlayerClass(player.identity.id, acceptedClassNames);

                //If the list is empty, it means this is a newly registered player, we assign the base class first alond with skill moo
                //Then we obtain the updated list again
                if(playerClasses.length === 0){

                    this.repo.assignClassToPlayer(player.identity.id, FacilityClasses.Volunteer.id);
                    this.repo.assignSkillToPlayer(player.identity.id, 1);

                    playerClasses = await this.repo.obtainPlayerClass(player.identity.id, acceptedClassNames);

                    console.log(`Player ${player.getName()} is new register, added class ${FacilityClasses.Volunteer.name}`);
                    console.log(`Player ${player.getName()} is new register, added skill Moo`);

                }

                //Show available classes
                this.selectClassService.listPlayerClasses(player);

                return;
            }

        }
        
        if(msg.message.Type === "Chat"){

        }
    }

    private async validCharacter(character: API_Character) : Promise<boolean>{

        //Check permission level
        const allow = await character.GetAllowItem();

        //Check chest type

        //Check item permission

        return true;
    }

    private commandPermission(character: API_Character, isRegistered: boolean = false, isAdmin: boolean = false) : boolean{
        const id = character.MemberNumber;
        const player = this.router.get(id) as DairyPlayer | undefined;
        const registered = !!player;
        const admin = character.IsRoomAdmin();

        // Admin-only commands: require admin, whisper on fail
        if (isAdmin && !admin) {
            this.messages.whisper(id, dialog.error.noPermission);
            return false;
        }
        // Registration-gated commands: allow registered users (or admins), whisper on fail
        if (isRegistered && !registered) {
            this.messages.whisper(id, dialog.error.notRegistered);
            return false;
        }
        // No special requirement
        return true;
    }

    //Room commands
    //Select class by name
    private onCommandSelect = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

         // Ensure the sender has permission (must be registered)
        if (!this.commandPermission(sender, true)) return;

        if(args.length < 1){
            this.conn.reply(
                msg,
                "(Usage: select <class name>)",
            );
            return;
        }
    
        // Normalize input
        const formattedInput = args.join(" ").trim();

        // search in FacilityClasses matching class id by name using formattedInput
        const match = Object.values(FacilityClasses).find(
            (c) => c.name.toLowerCase() === formattedInput.toLowerCase()
        );

        const player = this.router.get(sender.MemberNumber);

        if(!match){
            this.conn.reply(msg, `(ERROR, class name not found)`);
            return;
        }

        // Delegate selection to service (will update modules and persist)
        await this.selectClassService.select(player as DairyPlayer, match.id, FacilityConfig.acceptedClassNames);

        player.get<ClassingModule>("classing").printClassInfo();
        
    };

    //Display class info
    private onCommandClass = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

         // Ensure the sender has permission (must be registered)
        if (!this.commandPermission(sender, true)) return;

        const player = this.router.get(sender.MemberNumber);

        player.get<ClassingModule>("classing").printClassInfo();
        
    };

    //Display skills info
    private onCommandSkills = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

         // Ensure the sender has permission (must be registered)
        if (!this.commandPermission(sender, true)) return;

        const player = this.router.get(sender.MemberNumber);

        this.messages.whisper(player.identity.id, player.get<SkillsModule>("skills").printSkillsInfo());
        
        
    };

}
