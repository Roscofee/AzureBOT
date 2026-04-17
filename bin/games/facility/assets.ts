import { BC_AppearanceItem } from "bc-bot";

export const normalPlayerCommandGuideLines = [
    "-/bot help : whispers this command guide to you",
    "-/bot select <class name> : selects one of your unlocked classes",
    "-/bot class : shows your current class details and progress",
    "-/bot skills : whispers your current skills and their effects",
    "-/bot classShop [class name] : lists class shop options or buys the named class",
    "-/bot skillShop [skill name] : lists skill shop options or buys the named skill",
    "-/bot skillUpgrade [skill name] : lists upgradable skills or upgrades the named skill",
];

export const getNormalPlayerCommandGuide = (): string =>
    `(\n${normalPlayerCommandGuideLines.join("\n")}\n)`;

export const makeBio = (
    leaderBoard?: string,
) =>
`🌎 Azure Corporation facility A-1: Dairy Blue Farms 🌎
=======================================================

Welcome to Dairy Blue Farms, here we strive to offer a completely different milking experience!
All visitors are free to join as long as they comply with facility specifications please use the 
(scanner) to check if you are eligible to join us for a shift or two.

If you are, you will be put under the care of our certified handlers so just relax an enjoy an 
unique and relaxing experience!

Disclaimer : Volunteers forteit the right to pursue legal action in the case of lose of self,
permanent physiology modifications, subliminal trai-[REDACTED].

ℹ️ How To Play
==============
To join just write *scanner
-Then use /bot select <className> to select your class from the list
-Walk towards any locker to get your uniform
-Once you are dressed and have your class selected walk to the entry area over any diamon shape to get assigned a workstation
-To confirm your workstation simply walk one step back the pink area and enter again

ℹ️ Room Commands
==============
${normalPlayerCommandGuideLines.join("\n")}`;

export const MAP = "N4IgKgngDgpiBcICCAbA7gQwgZxAGnAEsUZdFA6EEBkQamm8+hxp5lhwDEAB1jtzjgJY6MA1yNFiRjAHbSZM+hwAT4vnwYiAIZq3aJ9Wfvp9xIweQ3aLm3YA4QW9fJ37Z8+tHPLH10PIAHv+Ulff2chLTcXTzChPz8ZGPpRKO9dYzEE7xi44NSJCQAvgoKRQoLnBx9bSVsK9KZc4oAggAKGvMaWtol4wPjhXXShPKbhzqGR0RifLJ8+twGxptHhxbdM6V6EsLV21p3O7189ehnDF2NyBaWR530Dcg4z8Qvlq8Wb27lyI1CrUtE85q7QaA/blSrVJwPH6uP7FF5w8Zdfw9YJQsKwwbwzGI6JrSS9b7ovIhAEdParWLrVFnWEXErFEplawVaxVZmQx7JA5pELcjLIoInAb9HIAYNFOUm01mIuhVnFcq8gul6SiwrECtSrD6FgZJUK4v1JQ+0k2li54jyhq1JsCZg8yV1VtFbWWw28tvVaUVg2tTXI/qaHpNdQO20t1vOnvIABMY4w49qkwwQ7G4+nE/RACfgOYYCgAZwoFAwc1mUx96BmM+QFKWcwo+AXC4262W+J6q+ma62G4Wiyoe+2Q53Ey36yoi82i6X+7IpnIR/GVBOG42+8vV8u57JY4AF8Az+6+y+PBf7x+P28+Md3N8PR/PjcnD63JtULBX56Lk/z+eXP/ztrPiem4qIWYH/hBQ7rLIQFng+X5NhBv5QfiMEnhOQFrnBD6XtI+AgAA8gARgAVjAADGAAuZAgIudH0Qx6aAKvgMaAB/gMaAM/g7FcYxi6AE/AgA/wAJ6aAAggImACQg6YcYAaBCybJMYsRmgBjQCpMaqSpSlVpJVYAEV8XGrHSYAW+DpkZ0kcbxDGAC3wnbyQ0ABpDQxvJynqZpGmLoA1fAxt5GZOTGgAnQEFcb+ZZ6aAHfgEUxpFGaAAKAgBsgFW8WxVWclpXJi6RTF6ahX5YWdtlcaFXGgDJyFZJW2Yx0mdt5vlhdVDENdlWUjoASEDpu1GYNfR3VRcVOWOZVjUZsVhXVQ0AW5fllmGTGE1TdNjEyXNk1xilca9YuvWjV1K1OYAEEC7cNVa1VWs3zWt6abSOTV9ZVF2HVdVUFdFVbLRdMbrYtr0jems1zXRaWAG3wQNpV5PnfZZzU/ZDYUtVWgDb4GpqlIzGgA4oIAPSCAP0ggCjIIAfSCAO0ggCtIPlNkjqFC2w+mgBYIOm9mfQAMSl9MxkTeOACMggBDIIAkyCANignaAC0gnNE4AwyAi3RIm0yFVahYAmKAxvLst8N9ku8YrCudtTgALMNrUvidpGZZnRgBNMLD+uG0bcbU3xgBkMIAdfB24AODB8VLi5WWTkPrV9sOAPfgPsZn7eUA2FgBAEJ2/t0YAYCDB050dh9NIcRwx8WJYu8dViH6dh0nI7RzG9ks3n6bpyO6dMTnnbe5dMYl5ZFediZplU5Dme11Tmdpx3+X1xmJdh23GaSNgdE93GHet2PmdMQP9GjzGIAAL5AA===";
export const Locker = 1050;
export const WorkStation = 130;

export const uniform : string = "NobwRAcghgtgpmAXGAEgBgJwFY1gDRgDiATgPYCuADkqnAJYDmAFgC75gDCpANqcTQBE4AMyjlubAL55w0eDQh8YUbuxIVqyAEKkAJgE8AqpUpx+BLr37IA6kzosEBAAplTxFvqTgAKvtMASnAAxny63mCepuGIaNJgfqZIAHbi3JLSsrAIyIrEyqoE6lQ0OgYAMqQA7mbslnyCImISYJmQ2TQoUHTEAGJkySwAjABGamQlyF09/aSDdTwNyADEAByjQ3AA7K0y7fJT3cRaUMEA1qPjGp1HJ+cLVo2i4lJ7cjlgAKL6cCNkVQBnIZXSZfH5/aoAh5LMBCZ4tNrvGjfOBAkGaMGo6HWWFNF67LIHTFoooTDEogEAJmxT2ar0JHyCDHEUHMRDJNAAshQWEwacg4XT2K5SO5PBFEnAgqFiDFwKpYgQ2LF4gI6MJhHRgi8vIqwFpePdEMAALoET4akLK00EFB0XQ5G2oe1wACSjhgSCdAEFuLwqt7giw6AA3By6n0sFjEOgjciOL1mhL+D7cNAsXAZN4dXJ0EzcVHA0nXXP5rEWRY4wX4xE5sDOcgAgH6Ivskv1xvN/m4+H0/YfADKTDgKFqxdBIuSFGSUIrjwFeIR2aJ1Za44xo6g4TnMNXfaR2m4jb569KR4BJ84ldpNeXH16R/ts7boIf5Cf3b3BP7yJgpGDoTJOiv7/lqcyfou+51l+p6HMkujPvUVaQd+B5gAOcBwLyEzMAO75sLB6H4ZUNRskhXpgMsHBoFoAhaBgYAmrWRIYVhTA4UweEOMByBcQRV7zsAlGrAALOsWyfOwX5JiKYq6r4KbSmEERRHAMRxAQkopGkWYMjQ5RQI4AAeA6kOcJIvhipnmfyQnLCJABsInOSJjHMR8BnGZ83AjNUhC8CG5aWTQ/mkIFiHXguvaoXWnlwEZWjEFArbFBiiVQBB0XufphnxVwxAAlhKUcsg+WFfx5HGpRIlbCJlJ1YxLhuGY4qIApgQhMpbWRCm6kZNlvHBgWUakKOcDcM+qU0EOpBBZVdmYItDEEMslJDEMWgbewaxoLtu2NfWzUePJyYdTKcqREgaAEMEV2quqmrahIurXfqhpnIm5qWkGn3Og6v12g67pwJ6xpJr6/qBsGYatZG0axvGjpMZIJpAA==";
export const regularUniform : string = "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=";

export let respiratorOffTypeRecord = {
    "f": 2,
    "g": 0,
    "s": 1,
    "m": 0,
    "l": 1
};

export const BOTPOS: ChatRoomMapPos = {X: 17, Y: 24};

export const workStations: Record<number, ChatRoomMapPos> = {
    1: { X: 15, Y: 17 },
    2: { X: 17, Y: 17 },
    3: { X: 22, Y: 17 },
    4: { X: 24, Y: 17 },
    5: { X: 15, Y: 14 },
    6: { X: 17, Y: 14 },
    7: { X: 22, Y: 14 },
    8: { X: 24, Y: 14 },
    9: { X: 15, Y: 11 },
    10: { X: 17, Y: 11 },
    11: { X: 22, Y: 11 },
    12: { X: 24, Y: 11 },
    13: { X: 15, Y: 8 },
    14: { X: 17, Y: 8 },
    15: { X: 22, Y: 8 },
    16: { X: 24, Y: 8 },
};

export const dressingStations: Record<number, ChatRoomMapPos> = {
    1: { X: 23, Y: 26 },
    2: { X: 24, Y: 26 },
    3: { X: 25, Y: 26 },
    4: { X: 26, Y: 26 },
    5: { X: 27, Y: 26 }
};

export const entryTeleportStations: Record<number, ChatRoomMapPos> = {
    1: { X: 12, Y: 25 },
    2: { X: 12, Y: 26 },
    3: { X: 14, Y: 25 },
    4: { X: 14, Y: 26 },
    5: { X: 16, Y: 25 },
    6: { X: 16, Y: 26 }
};

//#region Item definitions

//REGULAR SET

export const regularHarness: BC_AppearanceItem ={
    Group: "ItemTorso2",
    Name: "LeatherHarness",
    Difficulty: 90,
    Property: {TypeRecord: {typed: 0}},
    Craft: {
        Name: "NanoWeave harness",
        Description: "Automatically tightens around the body, keeping the bust up and holes available",
        Property: "Normal",
        Color: undefined,
        Lock: "",
        Item: "LeatherHarness",
        Private: true,
        ItemProperty: undefined,
        MemberName: "Azure Corporation",
        MemberNumber: 1
    }
    
}

export const regularArmCuffs: BC_AppearanceItem ={
    Group: "ItemArms",
    Name: "LeatherDeluxeCuffs",
    Difficulty: 90,
    Property: {TypeRecord: {typed: 0}},
    Color: ["#000000","#FFFFFF","#FFFFFF","Default"],
    Craft: {
        Name: "Regular's cuffs",
        Description: "Adapts perfectly to the body with built in control system for facility interaction",
        Property: "Normal",
        Color: '#000000,#FFFFFF,#FFFFFF,Default',
        Lock: "",
        Item: "LeatherDeluxeCuffs",
        Private: true,
        ItemProperty: undefined,
        MemberName: "Azure Corporation",
        MemberNumber: 1
    }
    
};

export const regularLegCuffs: BC_AppearanceItem ={
    Group: "ItemLegs",
    Name: "LeatherDeluxeLegCuffs",
    Difficulty: 90,
    Color: ["Default","#000000","#FFFFFF","#FFFFFF","Default"],
    Property: {TypeRecord: {typed: 0}},
    Craft: {
        Name: "Regular's cuffs",
        Description: "Adapts perfectly to the body with built in control system for facility interaction",
        Property: "Normal",
        Color: 'Default,#000000,#FFFFFF,#FFFFFF,Default',
        Lock: "",
        Item: "LeatherDeluxeLegCuffs",
        Private: true,
        ItemProperty: undefined,
        MemberName: "Azure Corporation",
        MemberNumber: 1
    }
    
};

export const regularAnkleCuffs: BC_AppearanceItem ={
    Group: "ItemFeet",
    Name: "LeatherDeluxeAnkleCuffs",
    Difficulty: 90,
    Property: {TypeRecord: {typed: 0}},
    Color: ["Default","#000000","#FFFFFF","#FFFFFF","Default"],
    Craft: {
        Name: "Regular's cuffs",
        Description: "Adapts perfectly to the body with built in control system for facility interaction",
        Property: "Normal",
        Color: 'Default,#000000,#FFFFFF,#FFFFFF,Default',
        Lock: "",
        Item: "LeatherDeluxeAnkleCuffs",
        Private: true,
        ItemProperty: undefined,
        MemberName: "Azure Corporation",
        MemberNumber: 1
    }
    
};

export let latexUpperCatsuit: BC_AppearanceItem = {
    Name: 'LatexCatsuit',
    Group: 'Suit',
    Color: ['#F4F4F4', '#000000', '#CECECE', '#000000'],
    Property: {
        TypeRecord: { typed: 0 },
        Text: 'Regular',
        Text2: '',
        Text3: ''
    },
    Craft: null,
    Difficulty: 69
};

//STANDARD RESTRAINS

export let highSteelArmsCuffs: BC_AppearanceItem = {
    Name: "HighStyleSteelCuffs",
    Group: "ItemArms",
    Color: ['Default', 'Default', 'Default'],
    Difficulty: 80,
    Craft: {
        Item: "HighStyleSteelCuffs",
        Name: "MagnetSec ankle restrains",
        Description: "Capatable of generating it's own magnetic field to interact with a variety of devices",
        Private: true,
        MemberNumber: 1,
        MemberName: "Dairy Blue Farms",
        Property: "Normal",
        Color: "",
        Lock: "",
        ItemProperty: undefined
    }
};

export let highSteelAnkleCuffs: BC_AppearanceItem = {
    Name: "HighStyleSteelAnkleCuffs",
    Group: "ItemFeet",
    Color: ['Default', 'Default', 'Default'],
    Difficulty: 80,
    Craft: {
        Item: "HighStyleSteelAnkleCuffs",
        Name: "MagnetSec wrist restrains",
        Description: "Capatable of generating it's own magnetic field to interact with a variety of devices",
        Private: true,
        MemberNumber: 1,
        MemberName: "AzureCorp",
        Property: "Normal",
        Color: "",
        Lock: "",
        ItemProperty: undefined
    }
};

export let shinyArmBinder: BC_AppearanceItem = {
    Name: "ShinyArmbinder",
    Group: "ItemArms",
    Color: ['Default', 'Default', 'Default', 'Default'],
    Difficulty: 80,
    Property: {TypeRecord: {typed: 3}},
    Craft: {
        Item: "ShinyArmbinder",
        Name: "Work Armbinder",
        Description: "Custom made to fit perfectly, keeps the subject arms useless",
        TypeRecord: { typed: 3 },
        Private: true,
        MemberNumber: 1,
        MemberName: "Dairy Blue Farms",
        Property: "Normal",
        Color: "",
        Lock: "",
        ItemProperty: undefined
    }
}

//WORK RESTRAINS 

export let latexRespirator: BC_AppearanceItem = {
    Name: "LatexRespirator",
    Group: "ItemMouth3",
    Color: undefined,
    Difficulty: 80,
    Property: {TypeRecord:{
            "f": 2,
            "g": 0,
            "s": 1,
            "m": 0,
            "l": 1
        }},
    Craft: {
        Color:"Default,Default,Default,Default,Default,#FB09BD",
        Description:"Steadily pumps sensitivity enhancers mixed with aphrodisiac to the user",
        Item:"LatexRespirator",
        ItemProperty:{},
        Lock:"",
        MemberName:"Dairy Blue Farms",
        MemberNumber:2,
        Name: "Enhancer pump (production)",
        Private:true,
        Property:"Normal",
        Type: null,
        TypeRecord:{
            "f": 2,
            "g": 0,
            "s": 1,
            "m": 0,
            "l": 1
        }
    }
}

export let pump: BC_AppearanceItem =  {
    Name: 'LactationPump',
    Group: 'ItemNipples',
    Color: ['Default'],
    Property: { SuctionLevel: 0 },
    Craft: null,
    Difficulty: 80
};

export let xCross: BC_AppearanceItem = {
    Name: 'X-Cross',
    Group: 'ItemDevices',
    Color: ['Default', 'Default'],
    Craft: null,
    Difficulty: 80
};

export let sybian: BC_AppearanceItem = {
    Name: 'Sybian',
    Group: 'ItemDevices',
    Color: ['Default'],
    Property: {
        //TypeRecord: [Object],
        Mode: 'Off',
        Intensity: -1,
        //Effect: [Array]
    },
    Difficulty: 90,
    Craft: {
        Name: "Bull mk1",
        Description: "Improved version over older workstations, includes active movement and pattern recognition for better cattle performance",
        Property: "Normal",
        Color: "",
        Lock: "",
        Item: 'Sybian',
        Private: false,
        ItemProperty: undefined, 
        MemberName: "Azure Corporation",
        MemberNumber: 1
    }
};

export let vibePlug: BC_AppearanceItem = {
    Name: 'EggVibePlugXXL',
    Group: 'ItemButt',
    Color: ['Default'],
    Property: {
        Mode: 'Off',
        Intensity: -1,
    },
    Difficulty: 80,
    Craft: {
        Name: "Bull mk1",
        Description: "Improved version over older workstations, includes active movement and pattern recognition for better cattle performance",
        Property: "Normal",
        Color: "",
        Lock: "",
        Item: 'EggVibePlugXXL',
        Private: false,
        ItemProperty: undefined, 
        MemberName: "Azure Corporation",
        MemberNumber: 1
    }
};
