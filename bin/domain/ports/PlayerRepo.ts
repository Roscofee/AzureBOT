// Row shape for the Player table
export interface PlayerRow {
  id: number;
  name: string;
  nickname: string | null;
  currency: number; 
  regular: boolean; 
  superadmin: boolean; 
  creation_date: string; 
}

export interface PlayerRepo {
  // currency / progress
  updateCurrency(playerId: number, currency: number): Promise<void>;
  updateClassProgress(args: {
    playerId: number;
    classId: number;
    level: number;
    xp: number;
    bestScore: number;
    score: number;
    energy: number;
  }): Promise<void>;

  // reads used by services/commands
  getPlayer(playerId: number): Promise<PlayerRow | null>;
  getEmployee(employeeId: number): Promise<any | null>;
  obtainPlayerCurrentSkillsFromClass(playerId: number, classId: number): Promise<{
    skill_id: number;
    skill_name: string;
    skill_description: string;
    upgrade_description: string;
    skill_level: number;
  }[]>;

  obtainPlayerClass(
    playerId: number,
    classNames: string[]
  ): Promise<any[]>;

  obtainPlayerClassShop(
    playerId: number,
    classNames: string[]
  ): Promise<
    { class_id: number; class_name: string; class_description: string }[]
  >;

  obtainPlayerClassSkillShop(
    playerId: number,
    classId: number
  ): Promise<
    {
      skill_id: number;
      skill_name: string;
      skill_description: string;
      upgrade_description: string;
      class_level_req: number;
      price: number;
      previous_skill_id?: number | null;
      previous_skill_level_req?: number | null;
      previous_skill_name?: string | null;
    }[]
  >;

  // writes used by shop/upgrade flows
  assignSkillToPlayer(playerId: number, skillId: number): Promise<void>;
  updatePlayerSkillLevel(playerId: number, skillId: number, newLevel: number): Promise<void>;
  assignClassToPlayer(playerId: number, classId: number): Promise<void>;

  // (optional) registration / flags you already have
  registerPlayer(id: number, name: string, nickname: string): Promise<void>;
  registerEmployee(playerId: number, department: string, type: string): Promise<void>;
  updatePlayerLegacy(id: number): Promise<void>;
  updatePlayerToRegular(id: number): Promise<void>;
}
