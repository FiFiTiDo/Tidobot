import "reflect-metadata";

import { setupDatabase } from "./Database/init";
setupDatabase().then(() => {
    require("./init");
});