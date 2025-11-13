import { API_Character, BC_AppearanceItem, isClothing } from "bc-bot";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function undressCharacter(
    character: API_Character,
): Promise<BC_AppearanceItem[]> {
    // Items to keep even if they are in clothing groups
    const EXCLUDE = new Set(["Glitter", "JewelrySet"]);

    // Take a deep snapshot of the current appearance to avoid mutating while iterating
    const original = character.Appearance.MakeAppearanceBundle();

    // Build what the bundle would look like with clothing removed, except allowlisted items
    const trimmed = original.filter(
        (item) => EXCLUDE.has(item.Name) || !isClothing(item),
    );

    // Apply removals to the live character appearance
    for (const item of original) {
        if (!EXCLUDE.has(item.Name) && isClothing(item)) {
            character.Appearance.RemoveItem(item.Group as any);
            // throttle updates to avoid server rejecting rapid changes
            await delay(200);
        }
    }

    // Push a full appearance update to ensure changes are applied
    character.sendAppearanceUpdate();

    return original;
}
