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
    API_Chatroom,
    importBundle,
    exportBundle,
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
import { ClassShopService } from "../domain/services/ClassShopService";
import { SkillShopService } from "../domain/services/SkillShopService";
import { SkillUpgradeService } from "../domain/services/SkillUpgradeService";
import { BullEngine } from "../domain/services/BullEngine";
import { PlayerRegisterService } from "../domain/services/PlayerGameRegistrationService";
import { PlayerFor } from "../domain/core/game-schema";
import { FacilitySchema } from "./facility/schema";
import { acceptedClassNames, FacilityClasses, FacilityConfig, FacilityEvents, SkillModEntry, StatDelta } from "./facility/config";
import _, { ceil } from "lodash";
import { dialog } from "../dialog/dialog";
// Ensure Facility skills are registered at startup (side-effect import)
import "./facility/skills/indext";
import { SkillsModule } from "../domain/modules/skills";
import { ClassingModule } from "../domain/modules/classing";
import { FlagsModule } from "../domain/modules/flags";
import { BOTPOS, dressingStations, entryTeleportStations, getNormalPlayerCommandGuide, makeBio, MAP, regularUniform, workStations } from "./facility/assets";
import { activateRespirator, disableRespirator, dressCharacterWithRegularUniform, dressCharacterWithStandardUniform, dressEquipmentMale, dressEquipmentRegular, dressEquipmentStandard, freeCharacter, setCharacterVibeMode, undressCharacter } from "./facility/appereanceUtils";
import { EconomyModule } from "../domain/modules/economy";
import { ScoringModule } from "../domain/modules/scoring";
import { QualityModule } from "../domain/modules/quality";
import { BullModule } from "../domain/modules/bull";
import { GlobalEventManager } from "./facility/events/GlobalEventManager";
import { GlobalEventDef } from "./facility/events/globalEvents";
import { AnyModifier } from "../domain/skills/Skill.types";

/**
 * Player type definition for this game, uses the configured schema
 */
type DairyPlayer = PlayerFor<typeof FacilitySchema>;

const listOfUsedItems: ([AssetGroupName, string] | [AssetGroupName, string[]])[] = [
    ["ItemDevices", ["Sybian", "X-Cross"]],
    ["ItemMouth3", "LatexRespirator"],
    ["ItemArms", ["LeatherDeluxeCuffs", "HighStyleSteelCuffs", "ShinyArmbinder"]],
    ["ItemLegs", ["LeatherDeluxeLegCuffs"]],
    ["ItemFeet", ["LeatherDeluxeAnkleCuffs", "HighStyleSteelAnkleCuffs"]],
    ["ItemNipples", "LactationPump"],
    ["ItemTorso2", "LeatherHarness"],
    ["ItemButt", 'EggVibePlugXXL']
];

const listOfUsedItemGroups = _.uniq(listOfUsedItems.map(i => i[0]));


export class Facility{
    
    private repo: PlayerRepo;
    private bus: DomainEventBus;
    private messages: MessagePort;
    private router : MessageRouter;
    private commandParser : CommandParser;
    private bullEngine: BullEngine;
    private dbRegisterService: PlayerRegisterService;
    private selectClassService: ClassSelectionService;
    private classShopService: ClassShopService;
    private skillShopService: SkillShopService;
    private skillUpgradeService: SkillUpgradeService;
    private globalEventManager: GlobalEventManager;
    /**
     * Track workstation assignment for registered players (MemberNumber -> workstationId)
     * and which player currently occupies each workstation.
     */
    private playerWorkstations = new Map<number, number>();
    private workstationOccupants = new Map<number, number>();
    /**
     * Round-robin cursor used to spread entry teleports across dressing stations.
     */
    private dressingStationCursor = 0;

    /**
     * Shift in progress flag, false when a shift is finished
     */
    private shiftInProgress: boolean = false;

    /**
     * Completed shifts counter
     */
    private shiftCounter = 0;

    /**
     * Farm open flag, false when farm is closed
     */
    private farmOpen: boolean = false;

    /**
     * Shift energy recovery modifiers
     * remainingShifts: number of shifts the modifier stays active; defaults to 1 (expires next shift)
     */
    private recoveryMods = new Map<number | "*", { multiplier?: number; bonus?: number; remainingShifts: number }[]>();

    private statDeltas = new Map<number | "*", StatDelta[]>();
    private skillMods = new Map<number | "*", SkillModEntry[]>();
    private lastShiftProduction = new Map<number, number>();

    public constructor(private conn: API_Connector){

        this.repo = new DBAdapter();
        this.bus = new DomainEventAdapter(conn);
        this.messages = new MessageAdapter(conn);
        this.globalEventManager = new GlobalEventManager(
            this.messages,
            this.bus,
            (evt) => this.applyGlobalEffects(evt),
            (evt) => this.removeGlobalEffects(evt)
        );
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
        
        this.bus.subscribe(FacilityEvents.shift.adjustRecovery, (evt) => {
            const { playerId = "*", multiplier, bonus, shifts } = evt.payload as {
                playerId?: number | "*";
                multiplier?: number;
                bonus?: number;
                shifts?: number; // number of shifts the modifier remains active
            };
            const remainingShifts = shifts && shifts > 0 ? shifts : 1;
            const list = this.recoveryMods.get(playerId) ?? [];
            list.push({ multiplier, bonus, remainingShifts });
            this.recoveryMods.set(playerId, list);
        });

        this.bus.subscribe("facility:global.statDelta", (evt) => {
            const { playerId = "*", target, op, value, shifts } = evt.payload as {
                playerId?: number | "*";
                target: StatDelta["target"];
                op: StatDelta["op"];
                value: number;
                shifts?: number;
            };
            const remainingShifts = shifts && shifts > 0 ? shifts : 1;
            const list = this.statDeltas.get(playerId) ?? [];
            list.push({ target, op, value, remainingShifts });
            this.statDeltas.set(playerId, list);
            });

        this.bus.subscribe("facility:global.skillModifier", (evt) => {
            const { playerId = "*", skillName, modifier, shifts } = evt.payload as {
                playerId?: number | "*";
                skillName?: string;
                modifier: AnyModifier;
                shifts?: number;
            };
            const remainingShifts = shifts && shifts > 0 ? shifts : 1;
            const list = this.skillMods.get(playerId) ?? [];
            list.push({ skillName, modifier, remainingShifts });
            this.skillMods.set(playerId, list);
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
                            this.messages.whisper(player.identity.id, `(\n` + result);
                        }
                    }
                }
            }
        );
        this.bullEngine = new BullEngine(this.bus, this.messages, (id) => {
            try { return this.router?.get(id); } catch { return undefined; }
        });
        this.dbRegisterService = new PlayerRegisterService(this.repo, this.messages);
        this.selectClassService = new ClassSelectionService(this.repo, this.messages, FacilityConfig);
        this.classShopService = new ClassShopService(this.repo, this.messages, {
            ...FacilityConfig.pricing,
            starterSkillsByClass: FacilityConfig.starterSkillsByClass,
        });
        this.skillShopService = new SkillShopService(this.repo, this.messages, FacilityConfig.pricing);
        this.skillUpgradeService = new SkillUpgradeService(this.repo, this.messages, {
            ...FacilityConfig.pricing,
            skillMaxLevel: FacilityConfig.skillMaxLevel,
        });

        this.commandParser = new CommandParser(conn);

        //Room commands definition
        //Super admin commands
        this.commandParser.register("farm", this.onCommandFarm);
        this.commandParser.register("capture", this.onCommandCapture);
        this.commandParser.register("test", this.onCommandTest);

        //Handler commands
        this.commandParser.register("reward", this.onCommandReward);
        this.commandParser.register("inspect", this.onCommandInspect);


        //Player display
        this.commandParser.register("select", this.onCommandSelect);
        this.commandParser.register("class", this.onCommandClass);
        this.commandParser.register("classShop", this.onCommandClassShop);
        this.commandParser.register("skills", this.onCommandSkills);
        this.commandParser.register("skillShop", this.onCommandSkillShop);
        this.commandParser.register("skillUpgrade", this.onCommandSkillUpgrade);
        this.commandParser.register("balance", this.onCommandBalance);
        this.commandParser.register("help", this.onCommandHelp);

        conn.on("Message", this.onMessage);
        conn.on("RoomCreate", this.onChatRoomCreated);
        conn.on("CharacterEntered", this.onCharacterEntered);
        conn.on("CharacterLeft", this.onCharacterLeft);


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
                if(!valid){

                    const aux = dialog.error.scanFail1.replace("$name", nickname || name);

                    this.messages.broadcast(aux);
                    return;
                }
                
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

                //If the list is empty, it means this is a newly registered player, we assign the base class and configured starter skills
                //Then we obtain the updated list again
                if(playerClasses.length === 0){

                    await this.repo.assignClassToPlayer(player.identity.id, FacilityClasses.Volunteer.id);
                    const starterSkills = FacilityConfig.starterSkillsByClass[FacilityClasses.Volunteer.id] ?? [];
                    for (const skillId of starterSkills) {
                        await this.repo.assignSkillToPlayer(player.identity.id, skillId);
                    }

                    playerClasses = await this.repo.obtainPlayerClass(player.identity.id, acceptedClassNames);

                    console.log(`Player ${player.getName()} is new register, added class ${FacilityClasses.Volunteer.name}`);
                    if (starterSkills.length > 0) {
                        console.log(`Player ${player.getName()} is new register, added starter skills ${starterSkills.join(", ")}`);
                    }

                }

                //Show available classes
                this.selectClassService.listPlayerClasses(player);

                return;
            }

            //Handler control emotes, again at this point this should be automatized
            if(msg.message.Content.includes("snaps her fingers")){
                if(!this.commandPermission(msg.sender, false, true)){return;}
                //For now restricting the usage to only main Handler
                if(msg.sender.MemberNumber !== 56731){return;}

                this.beginShift();
            }

            if(msg.message.Content.includes("claps her hands")){
                if(!this.commandPermission(msg.sender, false, true)){return;}
                //For now restricting the usage to only main Handler
                if(msg.sender.MemberNumber !== 56731){return;}

                this.reliefProtocol();
            }

            if(msg.message.Content.includes("break")){
                if(!this.commandPermission(msg.sender, false, true)){return;}
                //For now restricting the usage to only main Handler
                if(msg.sender.MemberNumber !== 56731){return;}

                this.endShift();
            }

            if(msg.message.Content.includes("check")){
                if(!this.commandPermission(msg.sender, false, true)){return;}
                //For now restricting the usage to only main Handler
                if(msg.sender.MemberNumber !== 56731){return;}

                this.listProduction();
            }

            if(msg.message.Content.includes("release button")){

                let player = this.router.get(msg.sender.MemberNumber);
                const flags = player.get<FlagsModule<DairyFlags>>("flags");
                const active = flags.get("active");

                if(player && (this.playerWorkstations.has(msg.sender.MemberNumber) || active)){

                    freeCharacter(msg.sender);

                }
            }

        }
        
        if(msg.message.Type === "Chat"){

        }

        if(msg.message.Type === "Activity"){
            //console.log(msg.message);

            let activityName = msg.message.Content.replace(/\d+/g, '');

            let player = this.router.get(msg.sender.MemberNumber);

            if(player && this.playerWorkstations.has(msg.sender.MemberNumber)) {

                const active = player.get<FlagsModule<DairyFlags>>("flags").get("active");

                if(active && this.farmOpen){

                    //Orgasm detection
                    if(activityName === "Orgasm"){

                        console.log(`[ORGASM] detected on: ${msg.sender.NickName || msg.sender.Name}`);

                        //Fire player.climax:orgasm event
                        const bull = player.tryGet<BullModule>("bull");
                        if (!bull) return;
                        const bullState = bull.getState();
                        this.bus.publish({
                            type: "player:climax.orgasm",
                            payload: {
                                playerId: player.identity.id,
                                playerName: player.getName(),
                                bullState,
                            },
                        });

                    }

                    //Orgasm resist detection
                    if(activityName === "OrgasmResist"){

                        console.log(`[ORGASM RESIST] detected on: ${msg.sender.NickName || msg.sender.Name}`);

                        //Fire player.climax:resist event
                        const bull = player.tryGet<BullModule>("bull");
                        if (!bull) return;
                        const bullState = bull.getState();
                        this.bus.publish({
                            type: "player:climax.resist",
                            payload: {
                                playerId: player.identity.id,
                                playerName: player.getName(),
                                bullState,
                            },
                        });

                    }

                }

            }
        }   
    }

    private async validCharacter(character: API_Character) : Promise<boolean>{

        // Check permission level
        const allow = await character.GetAllowItem();
        console.log(`[validCharacter] Item permissions allowed: ${allow} for ${character.Name} (${character.MemberNumber})`);

        if(!allow){
            this.messages.whisper(character.MemberNumber, dialog.error.permission1);
            return false;
        }

        // Check chest type
        const validChest = character.upperBodyStyle() === "female";
        console.log(`[validCharacter] Upper body style: ${character.upperBodyStyle()} (valid: ${validChest}) for ${character.Name} (${character.MemberNumber})`);

        if(!validChest){
            this.messages.whisper(character.MemberNumber, dialog.error.body1);
            return false;
        }

        // Check item permission with new ListOfUsedItems format (string or string[] per group)
        const itemsCannotUse: [AssetGroupName, string][] = [];
        console.log(`[validCharacter] Item check for ${character.Name} (${character.MemberNumber})`);
        for (const [group, assetNames] of listOfUsedItems) {
            const names = Array.isArray(assetNames) ? assetNames : [assetNames];
            for (const name of names) {
                const accessible = character.IsItemPermissionAccessible(AssetGet(group, name));
                if (!accessible) itemsCannotUse.push([group, name]);
            }
        }

        if(itemsCannotUse.length > 0){
            const result = `(Warning: The farm uses following items, but you have them blocked or limited:\n` +
                itemsCannotUse.map(([g, n]) => `${g}:${n}`).join(", ");

            this.messages.whisper(character.MemberNumber, result);
            return false;
        }
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

    //#region Room commands
    //Select class by name
    private onCommandSelect = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

        // Ensure the sender has permission (must be registered)
        if (!this.commandPermission(sender, true)) return;

        const player = this.router.get(sender.MemberNumber);

        if(args.length < 1){
            await this.selectClassService.listPlayerClasses(player as DairyPlayer, FacilityConfig.acceptedClassNames);
            return;
        }
    
        // Normalize input
        const formattedInput = args.join(" ").trim();

        // search in FacilityClasses matching class id by name using formattedInput
        const match = Object.values(FacilityClasses).find(
            (c) => c.name.toLowerCase() === formattedInput.toLowerCase()
        );

        if(!match){
            this.conn.reply(msg, `(ERROR, class name not found)`);
            return;
        }

        const flags = player?.get<FlagsModule<DairyFlags>>("flags");
        const active = flags?.get("active") === true;
        const assignedWorkstation = this.playerWorkstations.get(sender.MemberNumber);
        if (this.shiftInProgress && active && assignedWorkstation !== undefined) {
            this.messages.whisper(sender.MemberNumber, dialog.error.classChangeInWorkstation);
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

    //Display available classes for purchase
    private onCommandClassShop = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

         // Ensure the sender has permission (must be registered)
        if (!this.commandPermission(sender, true)) return;

        const player = this.router.get(sender.MemberNumber);

        if(args.length < 1){
            await this.classShopService.openShop(player as DairyPlayer, FacilityConfig.acceptedClassNames);
            return;
        }

        await this.classShopService.buy(player as DairyPlayer, args.join(" ").trim(), FacilityConfig.acceptedClassNames);
        
    };

    //Display available skills for purchase
    private onCommandSkillShop = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

         // Ensure the sender has permission (must be registered)
        if (!this.commandPermission(sender, true)) return;

        const player = this.router.get(sender.MemberNumber);

        if(args.length < 1){
            await this.skillShopService.openShop(player as DairyPlayer);
            return;
        }

        await this.skillShopService.buy(player as DairyPlayer, args.join(" ").trim());
        
    };

    //Display available skill upgrades or upgrade one skill by name
    private onCommandSkillUpgrade = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

         // Ensure the sender has permission (must be registered)
        if (!this.commandPermission(sender, true)) return;

        const player = this.router.get(sender.MemberNumber);

        if(args.length < 1){
            this.skillUpgradeService.openUpgradeList(player as DairyPlayer);
            return;
        }

        await this.skillUpgradeService.upgrade(player as DairyPlayer, args.join(" ").trim());
        
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

    //Display current player balance
    private onCommandBalance = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

         // Ensure the sender has permission (must be registered)
        if (!this.commandPermission(sender, true)) return;

        const player = this.router.get(sender.MemberNumber);
        const economy = player?.tryGet<EconomyModule>("economy");
        if (!economy) {
            this.messages.whisper(sender.MemberNumber, "(ERROR: missing economy module)");
            return;
        }

        this.messages.whisper(sender.MemberNumber, `(Current balance: ${economy.balance()} ACs)`);
    };

    //Display normal player command guide
    private onCommandHelp = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

         // Ensure the sender has permission (must be registered)
        if (!this.commandPermission(sender, true)) return;

        this.messages.whisper(sender.MemberNumber, getNormalPlayerCommandGuide());
    };

    //Open/close farm
    private onCommandFarm = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

         // Ensure the sender has permission (must be admin)
        if (!this.commandPermission(sender, false, true)) return;

        const acceptedCommands = ["open", "close"];

        if(args.length < 1 || !acceptedCommands.includes(args[0])){
            this.conn.reply(
                msg,
                "(Usage: farm <open||close>)",
            );
            return;
        }

        if(args[0].toLocaleLowerCase() === "open"){
            this.farmOpen = true;

            this.messages.broadcast(dialog.general.openFarm);
            this.messages.broadcast(dialog.general.openFarm2);

            //await this.setupRoom();
            this.conn.moveOnMap(BOTPOS.X, BOTPOS.Y);

        }else if(args[0].toLocaleLowerCase() === "close"){

            this.farmOpen = false;

            this.messages.broadcast(dialog.general.closeFarm);
            this.messages.broadcast(dialog.general.closeFarm2);

            //Free all active players
            for (const char of this.conn.chatRoom.characters) {
                const player = this.router.get(char.MemberNumber) as DairyPlayer | undefined;
                if (!player) continue;

                const flags = player.get<FlagsModule<DairyFlags>>("flags");
                const active = flags.get("active");
                const assignedWorkstation = this.playerWorkstations.has(player.identity.id);

                if (!active && !assignedWorkstation) continue;

                freeCharacter(char);
                flags.set("active", false);
                this.playerWorkstations.delete(player.identity.id);
            }
            this.playerWorkstations.clear();
            this.workstationOccupants.clear();
             
        }
    };

    //Capture a character in room
    private onCommandCapture = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

         // Ensure the sender has permission (must be admin)
        if (!this.commandPermission(sender, false, true)) return;

        if(args.length < 1){
            this.conn.reply(
                msg,
                "(Usage: capture <target>)",
            );
            return;
        }

        const target = this.conn.chatRoom.findCharacter(args[0]);
        
        if(!target){
            this.messages.whisper(sender.MemberNumber, `Capture target not found`);
            return;
        }

        const workstationId = this.findAvailableWorkstation();
        if (workstationId === null) {
            this.messages.whisper(sender.MemberNumber, `No free workstations available.`);
            return;
        }

        const workstationPos = workStations[workstationId];
        if (!workstationPos) {
            console.log(`ERROR: Workstation ${workstationId} has no coordinates defined.`);
            return;
        }
        const targetPos = this.getWorkstationLandingPosition(workstationPos);

        target.mapTeleport(targetPos);
        this.messages.whisper(sender.MemberNumber, `Moved ${target.Name} to workstation ${workstationId}.`);
    };

    //Reward the player currently occupying a workstation
    private onCommandReward = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

         // Ensure the sender has permission (must be admin)
        if (!this.commandPermission(sender, false, true)) return;

        if (args.length < 1) {
            this.conn.reply(
                msg,
                "(Usage: reward <workstation 1-16>)",
            );
            return;
        }

        const workstationId = Number(args[0]);
        if (!Number.isInteger(workstationId) || workstationId < 1 || workstationId > 16) {
            this.messages.whisper(sender.MemberNumber, "Workstation must be a number between 1 and 16.");
            return;
        }

        const playerId = this.workstationOccupants.get(workstationId);
        if (playerId === undefined) {
            this.messages.whisper(sender.MemberNumber, `No player assigned to workstation ${workstationId}.`);
            return;
        }

        const player = this.router.get(playerId) as DairyPlayer | undefined;
        if (!player) {
            this.messages.whisper(sender.MemberNumber, `Registered player for workstation ${workstationId} not found.`);
            this.workstationOccupants.delete(workstationId);
            return;
        }

        this.bus.publish({
            type: "player:bull.reward",
            payload: {
                playerId,
                charge: 10,
                workstationId,
                source: "facility.reward",
            },
        });

        this.messages.whisper(
            playerId,
            `(Your actions have been noticed and the bull throbs in acknowlegment.)`,
        );

        this.messages.whisper(
            sender.MemberNumber,
            `Rewarded ${player.getName()} at workstation ${workstationId} with 10 bull charge.`,
        );
    };

    //Inspect current production state for the player currently occupying a workstation
    private onCommandInspect = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

         // Ensure the sender has permission (must be admin)
        if (!this.commandPermission(sender, false, true)) return;

        if (args.length < 1) {
            this.conn.reply(
                msg,
                "(Usage: inspect <workstation 1-16>)",
            );
            return;
        }

        const workstationId = Number(args[0]);
        if (!Number.isInteger(workstationId) || workstationId < 1 || workstationId > 16) {
            this.messages.whisper(sender.MemberNumber, "Workstation must be a number between 1 and 16.");
            return;
        }

        const playerId = this.workstationOccupants.get(workstationId);
        if (playerId === undefined) {
            this.messages.whisper(sender.MemberNumber, `No player assigned to workstation ${workstationId}.`);
            return;
        }

        const player = this.router.get(playerId) as DairyPlayer | undefined;
        if (!player) {
            this.messages.whisper(sender.MemberNumber, `Registered player for workstation ${workstationId} not found.`);
            this.workstationOccupants.delete(workstationId);
            return;
        }

        const scoring = player.tryGet<ScoringModule>("scoring");
        const quality = player.tryGet<QualityModule>("quality");
        const bull = player.tryGet<BullModule>("bull");
        const classing = player.tryGet<ClassingModule>("classing");

        const cycleScore = scoring?.totals().cycleScore ?? 0;
        const sessionScore = scoring?.totals().sessionScore ?? 0;
        const qualityText = quality
            ? `${quality.getNormalizedQuality()}% [base ${quality.state.qualityScore.toFixed(2)}]`
            : "unavailable";
        const bullText = bull
            ? `${this.getBullStageLabel(bull)} ${bull.state.energy}/${this.getBullEnergyCap(bull)}${bull.state.ready ? " READY" : ""}`
            : "unavailable";
        const energyText = classing
            ? `${classing.state.currentEnergy}/${classing.state.maxEnergy}`
            : "unavailable";
        const modifierLines = this.getInspectionModifierLines(playerId, player);

        this.messages.whisper(
            sender.MemberNumber,
            `(` +
            `INSPECT WORKSTATION ${workstationId}\n` +
            `Player: ${player.getName()} [${playerId}]\n` +
            `Class: ${classing?.state.name ?? "Unassigned"} Lv${classing?.state.level ?? "0"} | Energy: ${energyText}\n` +
            `Production: shift ${cycleScore.toFixed(2)} L | session ${sessionScore.toFixed(2)} L\n` +
            `Quality: ${qualityText}\n` +
            `Bull: ${bullText}\n` +
            `Active modifiers:\n${modifierLines.join("\n")}` +
            `)`,
        );
    };

    //Test command
    private onCommandTest = async (
        sender: API_Character,
        msg: BC_Server_ChatRoomMessage,
        args: string[],
    ) => {

        // Ensure the sender has permission (must be admin)
        if (!this.commandPermission(sender, false, true)) return;

        if(args.length < 1){
            this.conn.reply(
                msg,
                "(Usage: test <target>)",
            );
            return;
        }

        const target = this.conn.chatRoom.findCharacter(args[0]);
        
        if(!target){
            this.messages.whisper(sender.MemberNumber, `test target not found`);
            return;
        }

        //const orignal = await undressCharacter(target);

        //await undressCharacter(target);
        //dressCharacterWithRegularUniform(target);
        //dressCharacterWithStandardUniform(target);
        //dressEquipmentStandard(target);

        //freeCharacter(target);

        

     
    };

    //#endregion
    //#region Room setup

    public async init(): Promise<void>{
        console.log(`Init function launched`);
        await this.setupRoom();
        await this.setupCharacter();
        this.playerWorkstations.clear();
        this.workstationOccupants.clear();
        this.addWorkstationTriggers();
        this.addDressingStationTriggers();
        this.addEntryTeleportStationTriggers();
    }

    private onChatRoomCreated = async () => {
        await this.setupRoom();
        await this.setupCharacter();
        this.playerWorkstations.clear();
        this.workstationOccupants.clear();
    };

    private onCharacterEntered = (char: API_Character): void => {
        this.clearStalePresenceState(char.MemberNumber, "entered");
    };

    private onCharacterLeft = (
        sourceMemberNumber: number,
        char: API_Character,
        leaveMessage: string | null,
        intentional: boolean,
    ): void => {
        this.clearStalePresenceState(sourceMemberNumber, "left");
    };

    private clearStalePresenceState(playerId: number, reason: "entered" | "left"): void {
        const player = this.router.get(playerId) as DairyPlayer | undefined;
        if (!player) return;

        const flags = player.tryGet<FlagsModule<DairyFlags>>("flags");
        const active = flags?.get("active") === true;
        const assigned = this.playerWorkstations.get(playerId);

        if (!active && assigned === undefined) return;

        if (assigned !== undefined) {
            this.unassignPlayerFromWorkstation(playerId, assigned);
        } else if (flags) {
            flags.set("active", false);
        }

        console.log(`Player ${player.getName()} (${playerId}) presence reset after ${reason}`);
    }

    private setupRoom = async () => {
            try {

                const map = JSON.parse(decompressFromBase64(MAP));
                map.Type = "Always"; // ensure maps are enabled
                this.conn.chatRoom.map.setMapFromData(map);
                console.log("Map set. Type:", this.conn.chatRoom.map.mapData?.Type);
    
            } catch (e) {
                console.log("Map data not loaded", e);
            }
    };

    private setupCharacter = async () => {

        this.conn.moveOnMap(BOTPOS.X, BOTPOS.Y);
        this.conn.accountUpdate({ Nickname: "Toaster"});
        this.conn.setBotDescription(makeBio());

    }
    //#endregion
    //#region Map triggers

    private addEntryTeleportStationTriggers = (): void => {
        for (const pos of Object.values(entryTeleportStations)) {
            this.conn.chatRoom.map.addTileTrigger(pos, (char) => {
                this.onEntryTeleportTrigger(char);
            });
        }
    };

    private onEntryTeleportTrigger(char: API_Character): void {

        //Validate farm is open
        if(!this.farmOpen){
            this.messages.whisper(char.MemberNumber, dialog.error.teleportClosed);
            return;
        }

        //Validate player is registered
        const player = this.router.get(char.MemberNumber) as DairyPlayer | undefined;
        if (!player) {
            console.log(`Teleport station triggered by unregistered ${char.Name} (${char.MemberNumber})`);
            this.messages.whisper(char.MemberNumber, dialog.error.notRegistered);
            return;
        }

        //Validate player is dressed
        const dressed = player.get<FlagsModule<DairyFlags>>("flags").get("dressed");
        if (!dressed) {
            console.log(`Teleport uniform check on: ${char.Name} (${char.MemberNumber} false)`);
            this.messages.whisper(char.MemberNumber, dialog.error.notDressed);
            return;
        }

        //Validate player has class
        const hasClass : boolean = player.get<ClassingModule>("classing").state.classId !== -1;
        if(!hasClass){
            console.log(`${char.Name} (${char.MemberNumber} no class selected`);
            this.messages.whisper(char.MemberNumber, dialog.error.noClass);
            return;
        }

        //Validate shift is not in progress
        if(this.shiftInProgress){
            this.messages.whisper(char.MemberNumber, dialog.error.shiftInProgress);
            return;
        }

        const workstationId = this.findAvailableWorkstation();
        if (workstationId === null) {
            this.messages.whisper(char.MemberNumber, `(No free workstations available.)`);
            return;
        }

        const workstationPos = workStations[workstationId];
        if (!workstationPos) {
            console.log(`ERROR: Workstation ${workstationId} has no coordinates defined.`);
            return;
        }
        const targetPos = this.getWorkstationLandingPosition(workstationPos);

        char.mapTeleport(targetPos);
        //this.messages.whisper(char.MemberNumber, `Moved ${char.Name} to workstation ${workstationId}.`);
    }

    private addDressingStationTriggers = (): void => {
        for (const [idStr, pos] of Object.entries(dressingStations)) {
            const id = Number(idStr);
            this.conn.chatRoom.map.addTileTrigger(pos, (char) => {
                void this.onDressingStationTrigger(id, char);
            });
        }
    };

    private async onDressingStationTrigger(id: number, char: API_Character): Promise<void> {
        //Validate player is registered
        const player = this.router.get(char.MemberNumber) as DairyPlayer | undefined;
        if (!player) {
            console.log(`Teleport station triggered by unregistered ${char.Name} (${char.MemberNumber})`);
            this.messages.whisper(char.MemberNumber, dialog.error.notRegistered);
            return;
        }

        const flags = player.get<FlagsModule<DairyFlags>>("flags");
        const dressed = flags.get("dressed") === true;

        if (!this.farmOpen && !dressed) {
            this.messages.whisper(char.MemberNumber, dialog.error.lockerClosed);
            return;
        }

        try {

           this.messages.whisper(char.MemberNumber, dialog.phase1.dressingStart);
           if(dressed){

                const originalBundle =  importBundle(flags.get("originalAttire"));

                if(!originalBundle){
                    console.log(`Player ${player.getName()} (${player.identity.id}) has no valid redress bundle, aborting`);
                    return;
                }

                await undressCharacter(char);

                char.Appearance.applyBundle(originalBundle);

                console.log(`Player ${player.getName()} (${player.identity.id}) redressed with original attire at station ${id}`);

                //Set dressed flag to false
                flags.set("dressed", false);
                //Set originalAttire to undefined
                flags.set("originalAttire", undefined);


           }else{
                const original = await undressCharacter(char);

                //Copy orginal attire for redressing
                flags.set("originalAttire", exportBundle(original));
                //Set dressed flag to true
                flags.set("dressed", true);

                const isRegular = flags.get("regular") === true;

                if(isRegular){
                    dressCharacterWithRegularUniform(char);
                }else{
                    dressCharacterWithStandardUniform(char);
                }
                
                console.log(`Player ${player.getName()} (${player.identity.id}) dressed at station ${id} with regular = ${isRegular}`);
           }

           this.messages.whisper(char.MemberNumber, dialog.phase1.dressingFinish + "\n" + dialog.phase1.stepOnTeleport);
        } catch (err) {
            console.log(`Failed to dress player ${player.getName()} at station ${id}`, err);
        }
    }

    private addWorkstationTriggers = (): void => {
        for (const [idStr, pos] of Object.entries(workStations)) {
            const id = Number(idStr);
            this.conn.chatRoom.map.addTileTrigger(pos, (char, prevPos) => {
                this.onWorkstationTrigger(id, char, prevPos);
            });
            const region: MapRegion = { TopLeft: { ...pos }, BottomRight: { ...pos } };
            this.conn.chatRoom.map.addLeaveRegionTrigger(region, (char) => {
                this.onWorkstationLeave(id, char);
            });
        }
    }

    private onWorkstationTrigger(id: number, char: API_Character, prevPos: { X: number; Y: number }): void {
        const player = this.router.get(char.MemberNumber) as DairyPlayer | undefined;
        if (!player) {
            console.log(`Workstation ${id} triggered by unregistered ${char.Name} (${char.MemberNumber})`);
            return;
        }

        if (!this.farmOpen) {
            this.messages.whisper(char.MemberNumber, dialog.error.farmclosed);
            return;
        }

        const previousStation = this.playerWorkstations.get(player.identity.id);
        this.assignPlayerToWorkstation(player.identity.id, id);
        if (previousStation === id) return;

        const detail =
            previousStation !== undefined
                ? `moved from workstation ${previousStation} to ${id}`
                : `assigned to workstation ${id}`;
        console.log(`Player ${player.getName()} (${player.identity.id}) ${detail}`);

        player.get<FlagsModule<DairyFlags>>("flags").set("active", true);

        this.hookingUpSquence(char, player);
    }

    private onWorkstationLeave(id: number, char: API_Character): void {
        const player = this.router.get(char.MemberNumber) as DairyPlayer | undefined;
        if (!player) return;

        const assigned = this.playerWorkstations.get(player.identity.id);
        if (assigned !== id) return;

        this.unassignPlayerFromWorkstation(player.identity.id, id);
        console.log(`Player ${player.getName()} (${player.identity.id}) left workstation ${id}`);
    }

    private assignPlayerToWorkstation(playerId: number, workstationId: number): void {
        const previousStation = this.playerWorkstations.get(playerId);
        if (previousStation !== undefined && previousStation !== workstationId) {
            this.workstationOccupants.delete(previousStation);
        }

        const currentOccupant = this.workstationOccupants.get(workstationId);
        if (currentOccupant !== undefined && currentOccupant !== playerId) {
            this.unassignPlayerFromWorkstation(currentOccupant, workstationId);
        }

        this.playerWorkstations.set(playerId, workstationId);
        this.workstationOccupants.set(workstationId, playerId);
    }

    private unassignPlayerFromWorkstation(playerId: number, workstationId?: number): void {
        const assigned = this.playerWorkstations.get(playerId);
        if (assigned === undefined) return;
        if (workstationId !== undefined && assigned !== workstationId) return;

        this.playerWorkstations.delete(playerId);
        this.workstationOccupants.delete(assigned);

        const player = this.router.get(playerId) as DairyPlayer | undefined;
        if (!player) return;

        player.get<FlagsModule<DairyFlags>>("flags").set("active", false);
    }

    private findAvailableWorkstation(): number | null {
        const orderedIds = Object.keys(workStations)
            .map((k) => Number(k))
            .sort((a, b) => a - b);
        for (const id of orderedIds) {
            if (!this.workstationOccupants.has(id)) {
                return id;
            }
        }
        return null;
    }

    private getWorkstationLandingPosition(workstationPos: { X: number; Y: number }): { X: number; Y: number } {
        return {
            X: workstationPos.X,
            Y: workstationPos.Y + 1,
        };
    }

    private getNextDressingStation(): ChatRoomMapPos | null {
        const ids = Object.keys(dressingStations)
            .map(Number)
            .sort((a, b) => a - b);
        if (ids.length === 0) return null;

        const idx = this.dressingStationCursor % ids.length;
        const stationId = ids[idx];
        this.dressingStationCursor = (this.dressingStationCursor + 1) % ids.length;

        return dressingStations[stationId];
    }


    /** Build a sorted production/quality snapshot for players currently at workstations */
    private buildProductionRanking() {
        const ranking: { id: number; name: string; className: string; production: number; quality: number }[] = [];

        for (const [, playerId] of this.workstationOccupants) {
            const player = this.router.get(playerId) as DairyPlayer | undefined;
            if (!player) continue;

            const scoring = player.tryGet<ScoringModule>("scoring");
            if (!scoring) continue;

            const classing = player.tryGet<ClassingModule>("classing");
            const qualityMod = player.tryGet<QualityModule>("quality");

            ranking.push({
                id: playerId,
                name: player.getName(),
                className: classing?.state.name ?? "Unassigned",
                production: scoring.totals().sessionScore ?? 0,
                quality: qualityMod ? qualityMod.getNormalizedQuality() : 0,
            });
        }

        return ranking.sort((a, b) => b.production - a.production);
    }

    /**
     * Ranks all active workstation occupants by current shift production.
     * Top 4 are broadcast; the rest receive a whisper with their own score.
     */
    public listProduction(): void {
        const ranking = this.buildProductionRanking();
        if (ranking.length === 0) {
            this.messages.broadcast("(No active producers right now)");
            return;
        }

        let rankingMessage = "(TOP PRODUCERS:\n";

        for (let i = 0; i < ranking.length; i++) {
            const entry = ranking[i];
            const prodText = entry.production.toFixed(2);
            const qualText = entry.quality.toString();

            if (i < 4) {
                const line = dialog.phase1.production
                    .replace("$class", entry.className)
                    .replace("$name", entry.name)
                    .replace("$production", prodText)
                    .replace("$quality", qualText);
                rankingMessage += line + "\n";
            } else {
                const whisper = dialog.phase1.productionSingle
                    .replace("$production", prodText)
                    .replace("$quality", qualText);
                this.messages.whisper(entry.id, whisper);
            }
        }

        rankingMessage += ")";
        this.messages.broadcast(rankingMessage);
    }


    //#endregion

    //#region Helper functions

    private hookingUpSquence(char: API_Character, player: DairyPlayer){

        const male = char.hasPenis();
        const regular = player.get<FlagsModule<DairyFlags>>("flags").get("regular");
        //Male equipment
        if(male){
            dressEquipmentMale(char);

            console.log(`Player ${player.getName()} (${player.identity.id}) dressed with male equipment`);

            return;
        }
        //Regular equipment
        if(regular){
            dressEquipmentRegular(char);

            console.log(`Player ${player.getName()} (${player.identity.id}) dressed with regular equipment`);

            return;
        }

        //Standard equipment
        if(!regular){
            dressEquipmentStandard(char);

            console.log(`Player ${player.getName()} (${player.identity.id}) dressed with standard equipment`);

            return;
        }
    }

    //Shift start
    beginShift(){
        if (!this.farmOpen || this.shiftInProgress) return;

        this.shiftInProgress = true;
        this.messages.broadcast(dialog.phase2.shiftStart);
        this.globalEventManager.fireNext();

        for (const [, playerId] of this.workstationOccupants) {
            const player = this.router.get(playerId) as DairyPlayer | undefined;
            if (!player) continue;

            //Search for the physical player on the room
            const char = this.conn.chatRoom.findCharacter(playerId.toString());
            if (!char) continue;

            // reset per‑shift state
            player.get<SkillsModule>("skills").resetAll();
            const classing = player.tryGet<ClassingModule>("classing");

            //Apply modifiers
            const mods = this.getSkillMods(playerId);
            if (mods.length) player.get<SkillsModule>("skills").applyModifiers(mods);

            // Apply quality decay based on last shift production
            // Apply quality decay based on previous shift production, but skip on first shift
            if (this.shiftCounter > 0) {
                const quality = player.tryGet<QualityModule>("quality");
                if (quality) {
                    const lastProd = this.lastShiftProduction.get(playerId) ?? 0;
                    if (lastProd > 0) {
                        quality.applyProductionDecay(lastProd);
                    }
                }
            }
            this.lastShiftProduction.delete(playerId);

            // wake up gear and vibes
            activateRespirator(char);
            const vibeGroup: AssetGroupName = char.hasPenis() ? "ItemButt" : "ItemDevices";
            setCharacterVibeMode(char, vibeGroup, 1); // 3 = Edge pattern on current assets

            this.messages.whisper(playerId, dialog.phase2.dStarts);
            this.messages.whisper(playerId, dialog.phase2.release);
        }
    }

    //Relief protocol, recover energy, pay players, xp gain
    async reliefProtocol() {

        // Broadcast message
        this.messages.broadcast(dialog.phase2.break);

        if (!this.shiftInProgress) return;

        this.shiftInProgress = false;
        const shiftNumber = ++this.shiftCounter;
        this.messages.broadcast(dialog.phase2.shiftEnd.replace("$number", String(shiftNumber)));
        this.bus.publish({
            type: FacilityEvents.shift.tick,
            payload: {
                shiftNumber,
                players: Array.from(this.workstationOccupants.values()),
            },
        });

        for (const [, playerId] of this.workstationOccupants) {
            const player = this.router.get(playerId) as DairyPlayer | undefined;
            if (!player) continue;

            const char = this.conn.chatRoom.findCharacter(playerId.toString());
            if (!char) continue;

            const vibeGroup: AssetGroupName = char.hasPenis() ? "ItemButt" : "ItemDevices";

            // Set vibes to max
            this.messages.whisper(playerId, dialog.phase2.dClimax);
            setCharacterVibeMode(char, vibeGroup, 4);   // push to max pattern

            //Base score increase using body size
            this.increaseProductionBase(playerId);

            // scoring → currency → XP
            const scoring = player.tryGet<ScoringModule>("scoring");
            if (scoring) {
                const cycle = scoring.totals().cycleScore ?? 0;
                this.lastShiftProduction.set(playerId, cycle);
                await scoring.commitShift();          // rolls cycleScore into session/total
            }

            // Currency and XP via dedicated helpers (with stat mods applied)
            this.applyShiftPayout(playerId);
            this.applyShiftXp(playerId);

            // Energy recovery (half max, modified via computeRecovery)
            const classing = player.tryGet<ClassingModule>("classing");
            if (classing) {
                const base = Math.floor(classing.state.maxEnergy / 2);
                const delta = this.computeRecovery(playerId, base);
                classing.state.currentEnergy = Math.min(classing.state.currentEnergy + delta, classing.state.maxEnergy);
                this.messages.whisper(playerId, `(Energy restored: +${delta}, now ${classing.state.currentEnergy}/${classing.state.maxEnergy})`);
            }

            scoring.resetProduction();
            player.get<SkillsModule>("skills").resetAll();
        }

    }

    async endShift() {
        // Announce break/open state and ensure shift flag is down
        this.messages.broadcast(dialog.phase2.break);
        this.shiftInProgress = false;

        //Advance event timers
        this.globalEventManager.tickShift();

        console.log(`shifts complete: ${this.shiftCounter}`);

        for (const [, playerId] of this.workstationOccupants) {
            const player = this.router.get(playerId) as DairyPlayer | undefined;
            if (!player) continue;

            const char = this.conn.chatRoom.findCharacter(playerId.toString());
            if (!char) continue;

            const vibeGroup: AssetGroupName = char.hasPenis() ? "ItemButt" : "ItemDevices";

            this.messages.whisper(playerId, dialog.phase2.dStops);
            setCharacterVibeMode(char, vibeGroup, 0); // stop device
            disableRespirator(char);                  // close gas flow

        }

        //Decay global effects
        this.decayGlobalEffects();

        // Remove expired modifiers for skills
        for (const [, playerId] of this.workstationOccupants) {
            const player = this.router.get(playerId) as DairyPlayer | undefined;
            if (!player) continue;
            const mods = this.getSkillMods(playerId); // exclude expired modifier
            player.get<SkillsModule>("skills").applyModifiers(mods); // replaces activeModifiers
        }

        this.listProduction();
    }

    private applyGlobalEffects(evt: GlobalEventDef) {
        // stats
        for (const s of evt.stats ?? []) {
            if (s.target === "energy") {
            // reuse recoveryMods as a global modifier
            const shifts = evt.durationShifts ?? 1;
            this.bus.publish({ type: FacilityEvents.shift.adjustRecovery, payload: { bonus: s.op === "add" ? s.value : undefined, multiplier: s.op === "mult" ? s.value : undefined, shifts } });
            }
            // xp/economy/score/custom: publish a bus event so other systems can subscribe
            this.bus.publish({ type: "facility:global.statDelta", payload: { target: s.target, op: s.op, value: s.value, shifts: evt.durationShifts ?? 1 } });
        }

        // skills: push modifiers into activeModifiers via bus or directly
        for (const sm of evt.skills ?? []) {
            this.bus.publish({
            type: "facility:global.skillModifier",
            payload: { skillName: sm.skillName, modifier: sm.modifier, shifts: sm.remainingShifts ?? evt.durationShifts ?? 1 }
            });
        }
    }

    private removeGlobalEffects(evt: GlobalEventDef) {
        // For stat deltas sent via bus, listeners should remove on expiry using the shifts counter they maintain.
        // For recoveryMods we don’t need explicit removal; they expire by shifts.
        this.bus.publish({ type: "facility:global.statDelta.clear", payload: { eventId: evt.id } });
        this.bus.publish({ type: "facility:global.skillModifier.clear", payload: { eventId: evt.id } });
    }

    private computeRecovery(playerId: number, base: number): number {
        const trimAndApply = (mods?: { multiplier?: number; bonus?: number; remainingShifts: number }[]) => {
            const kept: { multiplier?: number; bonus?: number; remainingShifts: number }[] = [];
            let amountDelta = 0;

            for (const m of mods ?? []) {
                if (m.remainingShifts <= 0) continue;
                const nextRemaining = m.remainingShifts - 1;

                // apply effect
                // multiplier effects are applied in computeRecovery aggregation below; we just pass through
                // bonuses are also applied later; aggregation expects the modifiers themselves
                kept.push({ ...m, remainingShifts: nextRemaining });
            }

            return kept;
        };

        const globals = trimAndApply(this.recoveryMods.get("*"));
        const personal = trimAndApply(this.recoveryMods.get(playerId));

        const all = [...globals, ...personal];
        let amount = base;
        for (const m of all) {
            if (m.multiplier != null) amount = Math.floor(amount * m.multiplier);
            if (m.bonus != null) amount += m.bonus;
        }

        // persist updated remainingShifts (already decremented)
        this.recoveryMods.set("*", globals.filter(m => m.remainingShifts > 0));
        this.recoveryMods.set(playerId, personal.filter(m => m.remainingShifts > 0));

        return amount;
    }
    private getStatMods(target: StatDelta["target"], playerId: number): StatDelta[] {
        const globals = this.statDeltas.get("*") ?? [];
        const personal = this.statDeltas.get(playerId) ?? [];
        return [...globals, ...personal].filter(m => m.target === target);
    }

    private applyStat(target: StatDelta["target"], base: number, playerId: number): number {
        let val = base;
        for (const m of this.getStatMods(target, playerId)) {
            if (m.op === "mult") val = Math.floor(val * m.value);
            else val += m.value;
        }
        return val;
    }

    private getSkillMods(playerId: number): AnyModifier[] {
        const globals = this.skillMods.get("*") ?? [];
        const personal = this.skillMods.get(playerId) ?? [];
        const merged = [...globals, ...personal];
        // if skillName is set, SkillEngine will filter via whitelist/blacklist on the modifier itself
        return merged.map(m => {
            if (m.skillName) {
                return { ...m.modifier, skillWhitelist: [...(m.modifier.skillWhitelist ?? []), m.skillName] };
            }
            return m.modifier;
        });
    }

    private getInspectionModifierLines(playerId: number, player: DairyPlayer): string[] {
        const lines: string[] = [];

        const skills = player.tryGet<SkillsModule>("skills");
        for (const modifier of skills?.state.activeModifiers ?? []) {
            lines.push(`- skill active: ${this.describeModifier(modifier)}`);
        }

        const quality = player.tryGet<QualityModule>("quality");
        for (const modifier of quality?.modifiers ?? []) {
            lines.push(`- quality: ${this.describeModifier(modifier)}`);
        }

        const bull = player.tryGet<BullModule>("bull");
        for (const modifier of bull?.modifiers ?? []) {
            lines.push(`- bull: ${this.describeModifier(modifier)}`);
        }

        for (const modifier of this.recoveryMods.get("*") ?? []) {
            lines.push(`- recovery global: ${this.describeModifier(modifier)}`);
        }
        for (const modifier of this.recoveryMods.get(playerId) ?? []) {
            lines.push(`- recovery player: ${this.describeModifier(modifier)}`);
        }

        for (const modifier of this.statDeltas.get("*") ?? []) {
            lines.push(`- stat global: ${this.describeModifier(modifier)}`);
        }
        for (const modifier of this.statDeltas.get(playerId) ?? []) {
            lines.push(`- stat player: ${this.describeModifier(modifier)}`);
        }

        for (const entry of this.skillMods.get("*") ?? []) {
            lines.push(`- skill queued global${entry.skillName ? ` (${entry.skillName})` : ""}: ${this.describeModifier({ ...entry.modifier, remainingShifts: entry.remainingShifts })}`);
        }
        for (const entry of this.skillMods.get(playerId) ?? []) {
            lines.push(`- skill queued player${entry.skillName ? ` (${entry.skillName})` : ""}: ${this.describeModifier({ ...entry.modifier, remainingShifts: entry.remainingShifts })}`);
        }

        return lines.length ? lines : ["- none"];
    }

    private describeModifier(modifier: object): string {
        const parts = Object.entries(modifier as Record<string, unknown>)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => `${key}=${this.describeModifierValue(value)}`);

        return parts.length ? parts.join(", ") : "empty";
    }

    private describeModifierValue(value: unknown): string {
        if (typeof value === "function") return "[function]";
        if (Array.isArray(value)) return `[${value.join(", ")}]`;
        if (value && typeof value === "object") {
            try {
                return JSON.stringify(value);
            } catch {
                return "[object]";
            }
        }
        return String(value);
    }

    private getBullStageLabel(bull: BullModule): string {
        if (bull.state.ready) return "ready";

        const cap = this.getBullEnergyCap(bull);
        const progress = cap > 0 ? bull.state.energy / cap : 0;

        if (progress <= 0) return "silent";
        if (progress >= 0.75) return "near ready";
        if (progress >= 0.5) return "halfway";
        if (progress >= 0.25) return "starting";
        return "low";
    }

    private getBullEnergyCap(bull: BullModule): number {
        return bull.state.threshold + bull.modifiers.reduce((acc, m) => acc + (m.energyMaxBonus ?? 0), 0);
    }

    private applyShiftPayout(playerId: number): number {
        const player = this.router.get(playerId) as DairyPlayer | undefined;
        const econ = player?.tryGet<EconomyModule>("economy");
        if (!econ) return 0;

        //Base wage
        const flags = player?.tryGet<FlagsModule<DairyFlags>>("flags");
        const isRegular = flags?.get("regular") === true;
        const base = isRegular ? 350 : 250;

        //Increases based on score
        const scoring = player.tryGet<ScoringModule>("scoring");
        if(!scoring) return 0;

        //50% of total session score direct increase
        const totalScoreIncrease = Math.floor(scoring.totals().sessionScore * 0.5);

        //Quality bonus: up to +10% of current base when quality is high
        const qualityMod = player.tryGet<QualityModule>("quality");
        const qualityMultiplier = qualityMod ? qualityMod.getQuality() : 1;

        const finalBase = Math.floor((base + totalScoreIncrease) * qualityMultiplier);

        const finalPayout = Math.max(0, this.applyStat("economy", finalBase, playerId));
        if (finalPayout > 0) {
            econ.add(finalPayout);
            const note = qualityMultiplier !== 1 ? ` (quality x${qualityMultiplier.toFixed(2)})` : "";
            this.messages.whisper(playerId, dialog.phase2.payRoll.replace("$wage", finalPayout.toString()) + note);
        }
        return finalPayout;
    }

    private applyShiftXp(playerId: number): number {
        const player = this.router.get(playerId) as DairyPlayer | undefined;
        const classing = this.router.get(playerId)?.tryGet<ClassingModule>("classing");
        if (!classing || classing.state.classId === -1) return 0;

        //Increases based on score
        let shiftScore = player.tryGet<ScoringModule>("scoring").totals().cycleScore;
        if(!shiftScore) shiftScore = 0;

        //Shift score above 25 will get up to +50% xp bonus
        const targetScore = 25;
        const maxBoost = 1.5
        const perfFactor = Math.min(maxBoost, 1 + Math.max(0, (shiftScore - targetScore) / targetScore))

        const baseXp = ceil(classing.state.xpToLevel / 3) * perfFactor;

        const finalXp = Math.max(0, this.applyStat("xp", baseXp, playerId));
        const levels = classing.gainXp(finalXp);
        if (levels > 0) {
            this.messages.whisper(playerId, `(You gained ${levels} level${levels > 1 ? "s" : ""}!)`);
        }
        return levels;
    }

    // Adds chest-based production directly into the scoring cycle score
    async increaseProductionBase(playerId: number) {
        const player = this.router.get(playerId) as DairyPlayer | undefined;
        if (!player) return;

        const char = this.conn.chatRoom.findCharacter(playerId.toString());
        if (!char) {
            console.log(`increaseProductionBase: ${playerId} not in room`);
            return;
        }

        const chestSize = char.Appearance.InventoryGet("BodyUpper").getData.name ?? "Normal";
        let chestReward = 0;
        switch (chestSize) {
            case "Small":  chestReward = 0.5; break;
            case "Normal": chestReward = 1;   break;
            case "Large":  chestReward = 1.5; break;
            case "XLarge": chestReward = 2;   break;
        }

        const scoring = player.tryGet<ScoringModule>("scoring");
        if (scoring) {
            scoring.addCycleScore(chestReward);
            console.log(`increaseProductionBase: ${player.getName()} +${chestReward} (size ${chestSize})`);
        }
    }

    /** Call once per shift end to age out modifiers */
    private decayGlobalEffects(): void {
        const decay = <T extends { remainingShifts: number }>(map: Map<number | "*", T[]>) => {
            for (const [k, list] of map) {
                const kept = list
                .map(m => ({ ...m, remainingShifts: m.remainingShifts - 1 }))
                .filter(m => m.remainingShifts > 0);
            if (kept.length) map.set(k, kept); else map.delete(k);
            }
        };
        decay(this.statDeltas);
        decay(this.skillMods);
    }

    //#endregion

}
