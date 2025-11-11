import { PlayerRepo, PlayerRow } from "../../domain/ports/PlayerRepo";
import DB from "./data/database";
import path from "node:path";

export class DBAdapter implements PlayerRepo {
  constructor(dbFilePath?: string) {
    const defaultPath = path.resolve(
      process.cwd(),
      "bin",
      "adapters",
      "db",
      "data",
      "database.db",
    );
    DB.getInstance(dbFilePath ?? defaultPath);
  }
  // Reads
  async getPlayer(playerId: number): Promise<PlayerRow | null> {
    return DB.getPlayer(playerId) as unknown as PlayerRow | null;
  }
  async getEmployee(employeeId: number) {
    return DB.getEmployee(employeeId);
  }

  async obtainPlayerCurrentSkillsFromClass(playerId: number, classId: number) {
    return DB.obtainPlayerCurrentSkillsFromClass(playerId, classId);
  }

  async obtainPlayerClass(playerId: number, classNames: string[]) {
    return DB.obtainPlayerClass(playerId, classNames);
  }

  async obtainPlayerClassShop(playerId: number, classNames: string[]) {
    return DB.obtainPlayerClassShop(playerId, classNames);
  }

  async obtainPlayerClassSkillShop(playerId: number, classId: number) {
    return DB.obtainPlayerClassSkillShop(playerId, classId);
  }

  // Writes
  async updateCurrency(playerId: number, currency: number) {
    return DB.updatePlayerCurrency(playerId, currency);
  }

  async updateClassProgress(args: {
    playerId: number;
    classId: number;
    level: number;
    xp: number;
    bestScore: number;
    score: number;
    energy: number;
  }) {
    const { playerId, classId, level, xp, bestScore, score, energy } = args;
    return DB.updatePlayerClassInfo(playerId, classId, level, xp, bestScore, score, energy);
  }

  async assignSkillToPlayer(playerId: number, skillId: number) {
    return DB.assignSkillToPlayer(playerId, skillId);
  }

  async updatePlayerSkillLevel(playerId: number, skillId: number, newLevel: number) {
    return DB.updatePlayerSkillLevel(playerId, skillId, newLevel);
  }

  async assignClassToPlayer(playerId: number, classId: number) {
    return DB.assignClassToPlayer(playerId, classId);
  }

  // Optional helpers you already have
  async registerPlayer(id: number, name: string, nickname: string) {
    return DB.registerPlayer(id, name, nickname);
  }
  async registerEmployee(playerId: number, department: string, type: string) {
    return DB.registerEmployee(playerId, department, type);
  }
  async updatePlayerLegacy(id: number) {
    return DB.updatePlayerLegacy(id);
  }
  async updatePlayerToRegular(id: number) {
    return DB.updatePlayerToRegular(id);
  }
}
