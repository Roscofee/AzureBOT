import { registerSkill } from "../../../domain/skills/SkillRegistry";
import { Moo } from "./Volunteer/Moo";
import { GasIntake } from "./Volunteer/GasIntake";

registerSkill("Moo", Moo);
registerSkill("GasIntake", GasIntake);

export{};
