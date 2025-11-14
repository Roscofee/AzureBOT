import { API_Character, BC_AppearanceItem, isBind, isClothing, importBundle, BundleApplyConfig } from "bc-bot";
import { latexUpperCatsuit, regularAnkleCuffs, regularArmCuffs, regularHarness, regularLegCuffs, regularUniform, uniform } from "./assets";

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
    const EXCLUDE_GROUPS = new Set(["ItemNeck", "ItemNeckAccessories"]);

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
