import { PlayerCore, PlayerModule } from "../core/PlayerCore";
import { ModifierDefinition } from "../moduleTypes/Modifier.types";
import { BullModifier } from "../moduleTypes/Bull.types";
import { ModifierModule } from "../modules/modifiers";
import { QualityModifier } from "../modules/quality";
import { AnyModifier } from "../skills/Skill.types";
import { fromBullModifier, fromQualityModifier, fromSkillModifier } from "../../games/facility/modifierHelpers";

export type SongNoteColor = "white" | "purple" | "red" | "orange" | "green" | "lightBlue" | "gold";
export type SongNoteFamily = "self" | "drive" | "restore" | "guard" | "crown";
export type SongPhraseKind = "song" | "melody" | "aria";
export type SongVariant = "S" | "L" | "XL";

export type SongNoteDefinition = {
  family: SongNoteFamily;
  tier: 0 | 1 | 2;
  label: string;
  icon: string;
  role: string;
};

export type SongNoteCatalog = Record<SongNoteColor, SongNoteDefinition>;

export type SongNote = {
  color: SongNoteColor;
  family: SongNoteFamily;
  icon: string;
  label: string;
  skillName: string;
  createdAt: number;
  power: number;
};

export type SongScope = "self" | "others";

export type SongRecipeVariant = {
  summary: string;
  durationShifts: number;
  skillModifiers?: { skillName?: string; modifier: AnyModifier; remainingShifts?: number }[];
  qualityModifiers?: { modifier: QualityModifier; remainingShifts?: number }[];
  bullModifiers?: { modifier: BullModifier; remainingShifts?: number }[];
  energyRestore?: number;
  bullCharge?: number;
  scoreBonus?: number;
  shiftScorePerLevel?: number;
  shiftEnergyPerLevel?: number;
  shiftXpBonus?: number;
  globalEventId?: string;
};

export type SongRecipeSlot = {
  family?: SongNoteFamily;
  colors?: SongNoteColor[];
};

export type SongRecipe = {
  id: string;
  name: string;
  kind: SongPhraseKind;
  pattern: SongNoteFamily[];
  slots?: SongRecipeSlot[];
  scope: SongScope;
  requiresGold?: boolean;
  variants?: Partial<Record<SongVariant, SongRecipeVariant>>;
  ariaEffect?: SongRecipeVariant;
};

export type ResolvedSong = SongRecipeVariant & {
  id: string;
  name: string;
  kind: SongPhraseKind;
  scope: SongScope;
  variant?: SongVariant;
  pattern: SongNoteFamily[];
  slots?: SongRecipeSlot[];
};

export type ActiveSong = ResolvedSong & {
  remainingShifts: number;
  performedAt: number;
};

export type SongComposeResult = {
  note: SongNote;
  melody: string;
  completedSong?: ResolvedSong;
  bufferedSong?: ResolvedSong;
  activatedSong?: ActiveSong;
  bufferRejected?: boolean;
};

export type SongModule = PlayerModule & {
  key: "song";
  state: {
    notes: SongNote[];
    activeSongs: ActiveSong[];
    storedSongs: ResolvedSong[];
    lastPlayedSong?: ResolvedSong;
    maxNotes: number;
  };
  composeNote(note: Omit<SongNote, "createdAt">): SongComposeResult;
  performStoredSong(index?: number): ActiveSong | undefined;
  replayLastSong(): ActiveSong | undefined;
  renderMelody(): string;
  clearNotes(): void;
  listActiveSongs(): ActiveSong[];
  listStoredSongs(): ResolvedSong[];
  getBufferCapacity(): number;
  getMelodyCapacity(): number;
  syncActiveEffects(preservedUses?: Map<string, number | undefined>): void;
};

const songSourcePrefix = "song:";
const songVariantOrder: SongVariant[] = ["S", "L", "XL"];
const songVariantRank: Record<SongVariant, number> = {
  S: 0,
  L: 1,
  XL: 2,
};

function createShiftBonusModifier(args: {
  id: string;
  sourceId: string;
  ownerPlayerId: number;
  target: "shift.scoreBonus" | "shift.energyBonus" | "shift.xpBonus";
  value: number;
  remainingShifts: number;
}): ModifierDefinition {
  return {
    id: args.id,
    sourceType: "song",
    sourceId: args.sourceId,
    ownerPlayerId: args.ownerPlayerId,
    target: args.target,
    operation: { type: "add", value: args.value },
    duration: { type: "shifts", remaining: args.remainingShifts },
    filters: { actionTypes: ["shiftEnd"] },
  };
}

export function createSongModule(songBook: SongRecipe[], noteCatalog: SongNoteCatalog, maxNotes = 5): SongModule {
  let player: PlayerCore | undefined;
  let unsubscribe: (() => void) | undefined;

  const state: SongModule["state"] = {
    notes: [],
    activeSongs: [],
    storedSongs: [],
    lastPlayedSong: undefined,
    maxNotes: Math.max(5, maxNotes),
  };

  const recipes = songBook.slice().sort((a, b) => b.pattern.length - a.pattern.length);
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe] as const));
  const recipeOrder = new Map(songBook.map((recipe, index) => [recipe.id, index] as const));

  const getBufferCapacity = () => {
    const classing = player?.tryGet<any>("classing");
    const level = classing?.state?.level ?? 1;
    let capacity = 2;
    if (level >= 50) capacity += 1;
    if (level >= 100) capacity += 1;
    return capacity;
  };

  const getMelodyCapacity = () => {
    const classing = player?.tryGet<any>("classing");
    const level = classing?.state?.level ?? 1;
    return level >= 50 ? 2 : 1;
  };

  const getRecipeSlots = (recipe: SongRecipe): SongRecipeSlot[] => (
    recipe.slots?.length
      ? recipe.slots
      : recipe.pattern.map((family) => ({ family }))
  );

  const evaluateRecipeMatch = (
    recipe: SongRecipe,
    notes: SongNote[],
  ): { matched: boolean; specificity: number } => {
    const slots = getRecipeSlots(recipe);
    if (slots.length !== notes.length) return { matched: false, specificity: 0 };
    if (recipe.requiresGold && !notes.some((note) => note.color === "gold")) {
      return { matched: false, specificity: 0 };
    }

    let specificity = 0;
    for (let index = 0; index < slots.length; index += 1) {
      const slot = slots[index];
      const note = notes[index];
      const family = slot.family ?? recipe.pattern[index];
      if (!note || note.family !== family) return { matched: false, specificity: 0 };

      if (!slot.colors?.length) {
        specificity += 1;
        continue;
      }

      const colorIndex = slot.colors.indexOf(note.color);
      if (colorIndex < 0) return { matched: false, specificity: 0 };
      specificity += colorIndex === 0 ? 4 : 3;
    }

    return { matched: true, specificity };
  };

  const matchesRecipePrefix = (recipe: SongRecipe, notes: SongNote[]): boolean => {
    const slots = getRecipeSlots(recipe);
    if (notes.length >= slots.length) return false;

    for (let index = 0; index < notes.length; index += 1) {
      const slot = slots[index];
      const note = notes[index];
      const family = slot.family ?? recipe.pattern[index];
      if (!note || note.family !== family) return false;
      if (slot.colors?.length && !slot.colors.includes(note.color)) return false;
    }

    return true;
  };

  const shouldDelaySuffixResolution = (candidateLength: number): boolean => {
    if (candidateLength >= state.notes.length) return false;

    return recipes.some((recipe) => {
      if (recipe.pattern.length <= state.notes.length) return false;
      return matchesRecipePrefix(recipe, state.notes);
    });
  };

  const resolveVariant = (notes: SongNote[]): SongVariant => {
    const maxTier = notes.reduce((max, note) => Math.max(max, noteCatalog[note.color]?.tier ?? 0), 0);
    if (maxTier >= 2) return "XL";
    if (maxTier >= 1) return "L";
    return "S";
  };

  const resolveRecipeVariantData = (recipe: SongRecipe, preferredVariant: SongVariant): { dataVariant: SongVariant; data: SongRecipeVariant } => {
    const preferredIndex = songVariantRank[preferredVariant];
    const searchOrder = [
      ...songVariantOrder.slice(0, preferredIndex + 1).reverse(),
      ...songVariantOrder.slice(preferredIndex + 1),
    ];

    for (const variant of searchOrder) {
      const data = recipe.variants?.[variant];
      if (data) return { dataVariant: variant, data };
    }

    throw new Error(`Song recipe ${recipe.id} has no usable variant data.`);
  };

  const createResolvedSong = (recipe: SongRecipe, variant: SongVariant, data: SongRecipeVariant): ResolvedSong => ({
    ...data,
    id: recipe.id,
    name: recipe.name,
    kind: recipe.kind,
    scope: recipe.scope,
    variant,
    pattern: recipe.pattern.slice(),
    slots: recipe.slots?.map((slot) => ({
      family: slot.family,
      colors: slot.colors?.slice(),
    })),
  });

  const resolveRecipeAtVariant = (recipe: SongRecipe, variant: SongVariant): ResolvedSong => {
    const match = resolveRecipeVariantData(recipe, variant);
    // Preserve the requested variant for stacking and UI even when the recipe
    // reuses lower-tier data because no exact tier override is defined.
    return createResolvedSong(recipe, variant, match.data);
  };

  const resolveRecipe = (recipe: SongRecipe, notes: SongNote[]): ResolvedSong => {
    if (recipe.kind === "aria") {
      if (!recipe.ariaEffect) {
        throw new Error(`Aria recipe ${recipe.id} has no ariaEffect data.`);
      }

      return {
        ...recipe.ariaEffect,
        id: recipe.id,
        name: recipe.name,
        kind: recipe.kind,
        scope: recipe.scope,
        pattern: recipe.pattern.slice(),
        slots: recipe.slots?.map((slot) => ({
          family: slot.family,
          colors: slot.colors?.slice(),
        })),
      };
    }

    return resolveRecipeAtVariant(recipe, resolveVariant(notes));
  };

  const promoteVariant = (variant: SongVariant): SongVariant => {
    if (variant === "S") return "L";
    return "XL";
  };

  const lowerVariant = (left: SongVariant, right: SongVariant): SongVariant => (
    songVariantRank[left] <= songVariantRank[right] ? left : right
  );

  const mergeVariants = (left: SongVariant, right: SongVariant): SongVariant => (
    left === right ? promoteVariant(left) : lowerVariant(left, right)
  );

  const createActiveSong = (resolved: ResolvedSong, remainingShifts = resolved.durationShifts): ActiveSong => ({
    ...resolved,
    pattern: resolved.pattern.slice(),
    slots: resolved.slots?.map((slot) => ({
      family: slot.family,
      colors: slot.colors?.slice(),
    })),
    remainingShifts,
    performedAt: Date.now(),
  });

  const overwriteActiveSong = (target: ActiveSong, next: ActiveSong) => {
    Object.assign(target, next, {
      pattern: next.pattern.slice(),
      slots: next.slots?.map((slot) => ({
        family: slot.family,
        colors: slot.colors?.slice(),
      })),
    });
  };

  const syncActiveEffects = (preservedUses?: Map<string, number | undefined>) => {
    if (!player) return;

    const modifiers = player.tryGet<ModifierModule>("modifiers");
    if (!modifiers) return;

    const localPreservedUses = preservedUses ?? modifiers.getUsesBySource(songSourcePrefix);
    modifiers.removeBySourcePrefix(songSourcePrefix);

    for (const song of state.activeSongs) {
      if (song.kind !== "melody") continue;

      for (const [index, entry] of (song.skillModifiers ?? []).entries()) {
        const sourceId = `${songSourcePrefix}${song.id}:${song.variant ?? "base"}:${index}`;
        const usesRemaining = localPreservedUses.has(sourceId)
          ? localPreservedUses.get(sourceId)
          : entry.modifier.usesRemaining;
        modifiers.addMany(fromSkillModifier({
          ...entry.modifier,
          usesRemaining,
        }, {
          id: `${sourceId}:${player.identity.id}`,
          sourceType: "song",
          sourceId,
          ownerPlayerId: player.identity.id,
        }));
      }

      for (const [index, entry] of (song.qualityModifiers ?? []).entries()) {
        const sourceId = `${songSourcePrefix}${song.id}:${song.variant ?? "base"}:quality:${index}`;
        modifiers.addMany(fromQualityModifier(
          entry.modifier,
          {
            id: `${sourceId}:${player.identity.id}`,
            sourceType: "song",
            sourceId,
            ownerPlayerId: player.identity.id,
            remainingShifts: entry.remainingShifts ?? song.remainingShifts,
          },
        ));
      }

      for (const [index, entry] of (song.bullModifiers ?? []).entries()) {
        const sourceId = `${songSourcePrefix}${song.id}:${song.variant ?? "base"}:bull:${index}`;
        modifiers.addMany(fromBullModifier({
          ...entry.modifier,
        }, {
          id: `${sourceId}:${player.identity.id}`,
          sourceType: "song",
          sourceId,
          ownerPlayerId: player.identity.id,
          remainingShifts: entry.remainingShifts ?? song.remainingShifts,
        }));
      }

      if ((song.shiftScorePerLevel ?? 0) !== 0) {
        const sourceId = `${songSourcePrefix}${song.id}:${song.variant ?? "base"}:shiftScore`;
        modifiers.add(createShiftBonusModifier({
          id: `${sourceId}:${player.identity.id}`,
          sourceId,
          ownerPlayerId: player.identity.id,
          target: "shift.scoreBonus",
          value: song.shiftScorePerLevel ?? 0,
          remainingShifts: song.remainingShifts,
        }));
      }

      if ((song.shiftEnergyPerLevel ?? 0) !== 0) {
        const sourceId = `${songSourcePrefix}${song.id}:${song.variant ?? "base"}:shiftEnergy`;
        modifiers.add(createShiftBonusModifier({
          id: `${sourceId}:${player.identity.id}`,
          sourceId,
          ownerPlayerId: player.identity.id,
          target: "shift.energyBonus",
          value: song.shiftEnergyPerLevel ?? 0,
          remainingShifts: song.remainingShifts,
        }));
      }

      if ((song.shiftXpBonus ?? 0) !== 0) {
        const sourceId = `${songSourcePrefix}${song.id}:${song.variant ?? "base"}:shiftXp`;
        modifiers.add(createShiftBonusModifier({
          id: `${sourceId}:${player.identity.id}`,
          sourceId,
          ownerPlayerId: player.identity.id,
          target: "shift.xpBonus",
          value: song.shiftXpBonus ?? 0,
          remainingShifts: song.remainingShifts,
        }));
      }
    }
  };

  const trimExpiredSongs = () => {
    for (const song of state.activeSongs) song.remainingShifts -= 1;
    for (let i = state.activeSongs.length - 1; i >= 0; i--) {
      if (state.activeSongs[i].remainingShifts <= 0) state.activeSongs.splice(i, 1);
    }
    syncActiveEffects();
  };

  const activateResolvedSong = (resolved: ResolvedSong): ActiveSong | undefined => {
    if (resolved.kind === "aria") return undefined;

    const existing = state.activeSongs.find((song) => song.id === resolved.id && song.kind === resolved.kind);
    if (!existing) {
      if (resolved.kind === "melody") {
        const activeMelodies = state.activeSongs
          .filter((song) => song.kind === "melody")
          .sort((a, b) => a.performedAt - b.performedAt);
        if (activeMelodies.length >= getMelodyCapacity()) {
          const replaced = activeMelodies[0];
          overwriteActiveSong(replaced, createActiveSong(resolved));
          syncActiveEffects();
          return replaced;
        }
      }

      const created = createActiveSong(resolved);
      state.activeSongs.push(created);
      syncActiveEffects();
      return created;
    }

    const recipe = recipeById.get(resolved.id);
    if (!recipe || !existing.variant || !resolved.variant) {
      overwriteActiveSong(existing, createActiveSong(resolved, existing.remainingShifts + 1));
      syncActiveEffects();
      return existing;
    }

    const mergedVariant = mergeVariants(existing.variant, resolved.variant);
    const mergedResolved = resolveRecipeAtVariant(recipe, mergedVariant);
    const downgraded = songVariantRank[mergedVariant] < songVariantRank[existing.variant];
    const nextDuration = downgraded
      ? mergedResolved.durationShifts
      : existing.remainingShifts + 1;

    overwriteActiveSong(existing, createActiveSong(
      mergedResolved,
      nextDuration,
    ));
    syncActiveEffects();
    return existing;
  };

  const mod: SongModule = {
    key: "song",
    state,
    onAttach(p) {
      player = p;
      unsubscribe = player.ctx.bus.subscribe("facility:shift.tick", () => {
        state.notes = [];
        trimExpiredSongs();
      });
    },
    onDetach() {
      unsubscribe?.();
    },
    composeNote(noteInput) {
      const noteDef = noteCatalog[noteInput.color];
      const note: SongNote = {
        ...noteInput,
        family: noteInput.family ?? noteDef.family,
        createdAt: Date.now(),
      };

      state.notes.push(note);
      if (state.notes.length > state.maxNotes) {
        state.notes = state.notes.slice(-state.maxNotes);
      }

      let completedSong: ResolvedSong | undefined;
      let bufferedSong: ResolvedSong | undefined;
      let activatedSong: ActiveSong | undefined;
      let bufferRejected = false;
      const matches = recipes
        .map((recipe) => {
          const usedNotes = state.notes.slice(-recipe.pattern.length);
          const match = evaluateRecipeMatch(recipe, usedNotes);
          return match.matched
            ? {
              recipe,
              usedNotes,
              specificity: match.specificity,
              order: recipeOrder.get(recipe.id) ?? Number.MAX_SAFE_INTEGER,
            }
            : undefined;
        })
        .filter((candidate): candidate is {
          recipe: SongRecipe;
          usedNotes: SongNote[];
          specificity: number;
          order: number;
        } => candidate != null);

      if (matches.length) {
        const maxLength = Math.max(...matches.map((candidate) => candidate.recipe.pattern.length));
        const bestMatch = matches
          .filter((candidate) => candidate.recipe.pattern.length === maxLength)
          .sort((left, right) => (
            right.specificity - left.specificity
            || left.order - right.order
          ))[0];

        if (!shouldDelaySuffixResolution(bestMatch.recipe.pattern.length)) {
          state.notes = state.notes.slice(0, -bestMatch.recipe.pattern.length);
          completedSong = resolveRecipe(bestMatch.recipe, bestMatch.usedNotes);
          if (completedSong.kind === "song") {
            if (state.storedSongs.length < getBufferCapacity()) {
              state.storedSongs.push(completedSong);
              bufferedSong = completedSong;
            } else {
              bufferRejected = true;
            }
          } else {
            activatedSong = activateResolvedSong(completedSong);
          }
        }
      }

      const name = player?.identity.nickname ?? player?.identity.name ?? "<unknown>";
      console.log(`[SONG] ${name} melody=${mod.renderMelody() || "<empty>"}`);

      return {
        note,
        melody: mod.renderMelody(),
        completedSong,
        bufferedSong,
        activatedSong,
        bufferRejected,
      };
    },
    performStoredSong(index = 0) {
      const stored = state.storedSongs[index];
      if (!stored) return undefined;
      state.storedSongs.splice(index, 1);
       state.lastPlayedSong = { ...stored, pattern: stored.pattern.slice() };
      return activateResolvedSong(stored);
    },
    replayLastSong() {
      if (!state.lastPlayedSong) return undefined;
      const replay = {
        ...state.lastPlayedSong,
        pattern: state.lastPlayedSong.pattern.slice(),
      };
      return activateResolvedSong(replay);
    },
    renderMelody() {
      return state.notes.map((note) => note.icon).join(" ");
    },
    clearNotes() {
      state.notes = [];
    },
    listActiveSongs() {
      return state.activeSongs.slice();
    },
    listStoredSongs() {
      return state.storedSongs.slice();
    },
    getBufferCapacity() {
      return getBufferCapacity();
    },
    getMelodyCapacity() {
      return getMelodyCapacity();
    },
    syncActiveEffects(preservedUses) {
      syncActiveEffects(preservedUses);
    },
  };

  return mod;
}
