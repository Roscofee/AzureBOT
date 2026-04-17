import { registerSkill } from "../../../domain/skills/SkillRegistry";
import { Moo } from "./Volunteer/Moo";
import { Focus } from "./Volunteer/Focus";
import { LiftChest } from "./Volunteer/LiftChest";
import { SteadySelf } from "./Volunteer/SteadySelf";
import { GamblersMoo } from "./Risky Heifer/GamblersMoo";
import { GasIntake } from "./Risky Heifer/GasIntake";
import { CarefulBreath } from "./Risky Heifer/CarefulBreath";
import { DeepBreath } from "./Risky Heifer/DeepBreath";

registerSkill("Moo", Moo);
registerSkill("Focus", Focus);
registerSkill("LiftChest", LiftChest);
registerSkill("SteadySelf", SteadySelf);
registerSkill("GamblersMoo", GamblersMoo);
registerSkill("GasIntake", GasIntake);
registerSkill("CarefulBreath", CarefulBreath);
registerSkill("DeepBreath", DeepBreath);

export{};
