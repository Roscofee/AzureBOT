import { GameSchema } from "../../domain/core/game-schema";
export const FacilitySchema : GameSchema = 
{ 
    required: ["classing", 
               "skills", 
               "economy", 
               "scoring",
               "flags",
               "skillLog",
               "quality",
               "song"] as const
};
