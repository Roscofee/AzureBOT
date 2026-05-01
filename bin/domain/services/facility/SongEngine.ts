import { PlayerCore } from "../../core/PlayerCore";
import { BullModule } from "../../modules/bull";
import { ClassingModule } from "../../modules/classing";
import { QualityModule } from "../../modules/quality";
import { ScoringModule } from "../../modules/scoring";
import { SongModule, SongNoteColor } from "../../modules/song";
import { SkillEffect } from "../../skills/Skill.types";
import { songNotes } from "../../../games/facility/events/songBook";

export class SongEngine {
  performPhrase(
    player: PlayerCore,
    args: { color: SongNoteColor; skillName: string; power: number }
  ): { effects: SkillEffect[]; feedback: string[] } {
    const song = player.tryGet<SongModule>("song");
    if (!song) {
      return { effects: [], feedback: ["Song module missing; no melody was recorded."] };
    }

    const noteDef = songNotes[args.color];
    const composed = song.composeNote({
      color: args.color,
      family: noteDef.family,
      icon: noteDef.icon,
      label: noteDef.label,
      skillName: args.skillName,
      power: args.power,
    });

    const feedback = [
      `Generated ${composed.note.icon} ${composed.note.label}. Melody: ${composed.melody || composed.note.icon}`,
    ];
    const effects: SkillEffect[] = [];

    if (composed.completedSong) {
      const completedSong = composed.completedSong;
      const phraseLabel = completedSong.variant
        ? `${completedSong.variant} ${completedSong.kind} ${completedSong.name}`
        : `${completedSong.kind} ${completedSong.name}`;
      feedback.push(`Completed ${phraseLabel}: ${completedSong.summary}`);

      if (composed.bufferedSong) {
        feedback.push(`Stored ${completedSong.name} in buffer (${song.listStoredSongs().length}/${song.getBufferCapacity()}).`);
      }

      if (composed.bufferRejected) {
        feedback.push(`Song buffer is full (${song.listStoredSongs().length}/${song.getBufferCapacity()}); the song was not stored.`);
      }

      if (composed.activatedSong && completedSong.kind === "melody" && completedSong.scope === "self") {
        this.applyImmediateSongEffects(player, composed.activatedSong, feedback);
        if (completedSong.kind === "melody") {
          effects.push({
            type: "EMIT_EVENT",
            event: {
              type: "facility:song.activated",
              payload: {
                playerId: player.identity.id,
                songId: composed.activatedSong.id,
                songName: composed.activatedSong.name,
                kind: composed.activatedSong.kind,
                variant: composed.activatedSong.variant,
                stackLevel: composed.activatedSong.stackLevel,
                remainingShifts: composed.activatedSong.remainingShifts,
                summary: composed.activatedSong.summary,
              },
            },
          });
          const activeMelodies = song.listActiveSongs().filter((activeSong) => activeSong.kind === "melody").length;
          feedback.push(
            `Activated ${completedSong.name} for ${composed.activatedSong.remainingShifts} shift(s). Melody slots: ${activeMelodies}/${song.getMelodyCapacity()}. Level ${composed.activatedSong.stackLevel}.`,
          );
        } else {
          feedback.push(`Activated ${completedSong.name} for ${composed.activatedSong.remainingShifts} shift(s).`);
        }
      }

      if (completedSong.kind === "aria" && (completedSong.scope === "others" || completedSong.globalEventId)) {
        effects.push({
          type: "EMIT_EVENT",
          event: {
            type: "facility:song.played",
            payload: {
              playerId: player.identity.id,
              songName: completedSong.name,
              summary: completedSong.summary,
              globalEventId: completedSong.globalEventId,
              song: completedSong,
            },
          },
        });
      }
    }

    return { effects, feedback };
  }

  performStoredSong(
    player: PlayerCore,
    args?: { index?: number }
  ): { effects: SkillEffect[]; feedback: string[] } {
    const song = player.tryGet<SongModule>("song");
    if (!song) {
      return { effects: [], feedback: ["Song module missing; no stored song could be played."] };
    }

    const active = song.performStoredSong(args?.index ?? 0);
    if (!active) {
      return { effects: [], feedback: ["No stored song is ready in your buffer."] };
    }

    const auraRange = Math.min(active.stackLevel, 3);
    const feedback = [
      `Performed ${(active.variant ?? "base")} song ${active.name}. Buffer: ${song.listStoredSongs().length}/${song.getBufferCapacity()}.`,
    ];
    feedback.push(`Song now buffs neighboring stations at range ${auraRange} for ${active.remainingShifts} shift(s). Level ${active.stackLevel}.`);
    return {
      effects: [
        {
          type: "EMIT_EVENT",
          event: {
            type: "facility:song.activated",
            payload: {
              playerId: player.identity.id,
              songId: active.id,
              songName: active.name,
              kind: active.kind,
              variant: active.variant,
              stackLevel: active.stackLevel,
              remainingShifts: active.remainingShifts,
              summary: active.summary,
            },
          },
        },
      ],
      feedback,
    };
  }

  performEncoreSong(player: PlayerCore): { effects: SkillEffect[]; feedback: string[] } {
    const song = player.tryGet<SongModule>("song");
    if (!song) {
      return { effects: [], feedback: ["Song module missing; encore could not replay the last song."] };
    }

    const active = song.replayLastSong();
    if (!active) {
      return { effects: [], feedback: ["No previously played song is available for encore."] };
    }

    const auraRange = Math.min(active.stackLevel, 3);
    return {
      effects: [
        {
          type: "EMIT_EVENT",
          event: {
            type: "facility:song.activated",
            payload: {
              playerId: player.identity.id,
              songId: active.id,
              songName: active.name,
              kind: active.kind,
              variant: active.variant,
              stackLevel: active.stackLevel,
              remainingShifts: active.remainingShifts,
              summary: active.summary,
            },
          },
        },
      ],
      feedback: [
        `Encore replayed ${(active.variant ?? "base")} song ${active.name}.`,
        `Song now buffs neighboring stations at range ${auraRange} for ${active.remainingShifts} shift(s). Level ${active.stackLevel}.`,
      ],
    };
  }

  private applyImmediateSongEffects(player: PlayerCore, completedSong: NonNullable<ReturnType<SongModule["performStoredSong"]>>, feedback: string[]) {
    const scoring = player.tryGet<ScoringModule>("scoring");
    if (scoring && completedSong.scoreBonus) {
      const bonus = completedSong.scoreBonus * completedSong.stackLevel;
      scoring.addCycleScore(bonus);
      feedback.push(`Score increased by ${bonus}.`);
    }

    const classing = player.tryGet<ClassingModule>("classing");
    if (classing && completedSong.energyRestore) {
      const before = classing.state.currentEnergy;
      classing.state.currentEnergy = Math.min(classing.state.maxEnergy, classing.state.currentEnergy + completedSong.energyRestore);
      const restored = classing.state.currentEnergy - before;
      if (restored > 0) feedback.push(`Recovered ${restored} energy.`);
    }

    const bull = player.tryGet<BullModule>("bull");
    if (bull && completedSong.bullCharge) {
      const bullCharge = completedSong.bullCharge * completedSong.stackLevel;
      const charge = bull.addCharge(bullCharge);
      if (charge.progressed > 0) feedback.push(`Bull charge increased by ${charge.progressed}.`);
    }

    const quality = player.tryGet<QualityModule>("quality");
    for (const entry of completedSong.qualityModifiers ?? []) {
      if (quality) {
        quality.applyModifier({
          ...entry.modifier,
          remainingShifts: entry.remainingShifts ?? completedSong.durationShifts,
        });
      }
    }
  }
}

export const songEngine = new SongEngine();
