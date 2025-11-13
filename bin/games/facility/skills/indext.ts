import { registerSkill } from "../../../domain/skills/SkillRegistry";
import { Moo } from "./Volunteer/Moo";
import { GasIntake } from "./Volunteer/GasIntake";
import { CarefulBreath } from "./Volunteer/CarefulBreath";
import { DeepBreath } from "./Volunteer/DeepBreath";

registerSkill("Moo", Moo);
registerSkill("GasIntake", GasIntake);
registerSkill("CarefulBreath", CarefulBreath);
registerSkill("DeepBreath", DeepBreath);

export{};
