import { PlayerCore, PlayerModule } from "../core/PlayerCore";
import { PlayerRepo } from "../ports/PlayerRepo";

export interface ScoringState {
  cycleScore: number; // production accumulated since last commit
  sessionScore: number;    // cumulative score for the session/round
  totalScore: number;      // persisted overall score
  bestScore: number;       // best session score achieved
}

export interface ScoringApi {
  addCycleScore(delta: number): void;
  setCycleScore(value: number): void;
  commitShift(persist?: boolean): Promise<void>;
  resetProduction(): void;
  totals(): Readonly<ScoringState>;
}

export type ScoringModule = PlayerModule & ScoringApi & { key: "scoring"; state: ScoringState };

/**
 * Scoring module inspired by the original Player scoring logic.
 * - cycleScore is accumulated by skills/effects during a shift.
 * - commitShift(): adds cycleScore to sessionScore (clamped >= 0),
 *   updates totalScore and bestScore, and optionally persists.
 */
export function createScoringModule(
  initial: Partial<ScoringState> | undefined,
  repo: PlayerRepo
): ScoringModule 
{
  let player: PlayerCore;

  const state: ScoringState = {
    cycleScore: initial?.cycleScore ?? 0,
    sessionScore: initial?.sessionScore ?? 0,
    totalScore: initial?.totalScore ?? 0,
    bestScore: initial?.bestScore ?? 0,
  };

  return {
    key: "scoring",
    state,

    onAttach(p) { player = p; },

    addCycleScore(delta: number) {
      this.state.cycleScore += delta;
    },

    setCycleScore(value: number) {
      this.state.cycleScore = value;
    },

    async commitShift(persist = true) {
      const applied = this.state.cycleScore;
      this.state.sessionScore += applied;
      if (this.state.sessionScore < 0) this.state.sessionScore = 0;

      // Update totals
      this.state.totalScore += this.state.sessionScore;
      if (this.state.sessionScore > this.state.bestScore) {
        this.state.bestScore = this.state.sessionScore;
      }

      // Reset shift production for next cycle
      this.state.cycleScore = 0;

      // Persist snapshot to repo (best_score / score), using classing when available
      if (persist) {
        const classing = player.tryGet<any>("classing");
        if (classing) {
          await repo.updateClassProgress({
            playerId: player.identity.id,
            classId: classing.state.classId,
            level: classing.state.level,
            xp: classing.state.xp,
            bestScore: this.state.bestScore,
            score: this.state.totalScore,
            energy: classing.state.maxEnergy,
          });
        }
      }
    },

    resetProduction() {
      this.state.cycleScore = 0;
    },

    totals() { return this.state; },
  };
}

