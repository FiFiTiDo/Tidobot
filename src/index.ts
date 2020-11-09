import "reflect-metadata";

import { setupDatabase } from "./Database";
setupDatabase().then(() => {
    require("./init");
});