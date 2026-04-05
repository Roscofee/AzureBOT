import { API_Character, BC_AppearanceItem, isBind, isClothing, importBundle, BundleApplyConfig, API_AppearanceItem } from "bc-bot";
import { highSteelAnkleCuffs, highSteelArmsCuffs, latexRespirator, latexUpperCatsuit, pump, regularAnkleCuffs, regularArmCuffs, regularHarness, regularLegCuffs, regularUniform, shinyArmBinder, sybian, uniform, vibePlug, xCross } from "./assets";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

const importConfig: BundleApplyConfig = {
    appearance: false,
    bodyCosplay: false,
    clothing: true,
    item: true,
}

export async function undressCharacter(
    character: API_Character,
): Promise<BC_AppearanceItem[]> {
    // Items to keep even if they are in clothing groups
    const EXCLUDE = new Set(["Glitter", "JewelrySet"]);

    // Item group to exclude removal
    const EXCLUDE_GROUPS = new Set(["ItemNeck", "ItemNeckAccessories", "EyeShadow"]);

    // Take a deep snapshot of the current appearance to avoid mutating while iterating
    const original = character.Appearance.MakeAppearanceBundle();

    // Build what the bundle would look like with clothing removed, except allowlisted items
    const trimmed = original.filter(
        (item) => EXCLUDE.has(item.Name) || !isClothing(item),
    );

    // Apply removals to the live character appearance
    for (const item of original) {
        if (!EXCLUDE.has(item.Name) && !EXCLUDE_GROUPS.has(item.Group) && (isClothing(item) || isBind(item))) {
            character.Appearance.RemoveItem(item.Group as any);
            // throttle updates to avoid server rejecting rapid changes
            await delay(200);
        }
    }

    // Push a full appearance update to ensure changes are applied
    character.sendAppearanceUpdate();

    return original;
}

export function dressCharacterWithRegularUniform(character: API_Character): void {
    const uniformBundle = importBundle(regularUniform).filter(
        (item) => isClothing(item) && !isBind(item),
    );

    //Set custom name on latex top suit
    latexUpperCatsuit.Property.Text3 = character.NickName || character.Name;

    //Add custom items
    uniformBundle.push(latexUpperCatsuit, regularHarness, regularArmCuffs, regularLegCuffs, regularAnkleCuffs);

    //Dress character
    character.Appearance.applyBundle(uniformBundle, importConfig, ["ItemNeck", "ItemNeckAccessories"]);
    character.sendAppearanceUpdate();
}

export function dressCharacterWithStandardUniform(character: API_Character): void {
    const uniformBundle = importBundle(uniform).filter(
        (item) => isClothing(item) && !isBind(item),
    );

    //Dress character
    character.Appearance.applyBundle(uniformBundle, importConfig, ["ItemNeck", "ItemNeckAccessories"]);
    character.sendAppearanceUpdate();
}

export function dressEquipmentStandard(character: API_Character): void {

    const equipmentBundle = [shinyArmBinder, latexRespirator, pump, sybian];

    character.Appearance.applyBundle(equipmentBundle, importConfig);
    character.sendAppearanceUpdate();

}

export function dressEquipmentRegular(character: API_Character): void {

    const cuffs = { ...regularArmCuffs, Property: { TypeRecord: { typed: 3 } } };

    const equipmentBundle = [latexRespirator, pump, sybian, cuffs];

    character.Appearance.applyBundle(equipmentBundle, importConfig);
    character.sendAppearanceUpdate();

}

export function dressEquipmentMale(character: API_Character): void {

    const equipmentBundle = [vibePlug, xCross, highSteelArmsCuffs, highSteelAnkleCuffs, latexRespirator, pump];

    character.Appearance.applyBundle(equipmentBundle, importConfig);
    character.sendAppearanceUpdate();

}

export function freeCharacter(character: API_Character): void{

    const itemArms : API_AppearanceItem = character.Appearance.InventoryGet("ItemArms");

    if(itemArms && (itemArms.Name  === "LeatherDeluxeCuffs" || itemArms.Name === "HighStyleSteelCuffs")){

        itemArms.Extended.SetType("Detached");

    }else{
        character.Appearance.RemoveItem("ItemArms");
    }

    character.Appearance.RemoveItem("ItemDevices");
    character.Appearance.RemoveItem("ItemNipples");
    character.Appearance.RemoveItem("ItemMouth3");

    character.sendAppearanceUpdate();

}

export function setCharacterVibeMode(
    character: API_Character,
    group: AssetGroupName,
    modeIndex: number,
): void {
    const item = character.Appearance.InventoryGet(group);
    if (!item) return; // nothing equipped

    const data: BC_AppearanceItem = item.getData();
    data.Property ??= {};
    data.Property.TypeRecord ??= {};

    // keep other type flags, just swap the vibrating one
    data.Property.TypeRecord.vibrating = modeIndex;

    // make sure the server sees it as vibrating
    const effects = new Set(data.Property.Effect ?? []);
    effects.add("Vibrating");
    data.Property.Effect = [...effects];

    // emit to server 
    character.sendItemUpdate(data);
}

export function activateRespirator(character: API_Character){
    
    const mask = character.Appearance.InventoryGet("ItemMouth3"); 
    if (!mask) return; // nothing equipped

    const data: BC_AppearanceItem = mask.getData();
    data.Property ??= {};
    data.Property.TypeRecord ??= {};

    data.Property.TypeRecord.g = 1;

    // emit to server 
    character.sendItemUpdate(data);
}

export function disableRespirator(character: API_Character){
    
    const mask = character.Appearance.InventoryGet("ItemMouth3"); 
    if (!mask) return; // nothing equipped

    const data: BC_AppearanceItem = mask.getData();
    data.Property ??= {};
    data.Property.TypeRecord ??= {};

    data.Property.TypeRecord.g = 0;

    // emit to server 
    character.sendItemUpdate(data);
}
