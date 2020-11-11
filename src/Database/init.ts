import Container from "typedi";
import { createConnection, useContainer } from "typeorm";
import { getLogger, logError } from "../Utilities/Logger";
import { BadWord } from "./Entities/BadWord";
import { Channel } from "./Entities/Channel";
import { ChannelSettings } from "./Entities/ChannelSettings";
import { Chatter } from "./Entities/Chatter";
import { ChatterPermission } from "./Entities/ChatterPermission";
import { Command } from "./Entities/Command";
import { Counter } from "./Entities/Counter";
import { DisabledModule } from "./Entities/DisabledModule";
import { DomainFilter } from "./Entities/DomainFilter";
import { Group } from "./Entities/Group";
import { GroupPermission } from "./Entities/GroupPermission";
import { List } from "./Entities/List";
import { ListItem } from "./Entities/ListItem";
import { News } from "./Entities/News";
import { Permission } from "./Entities/Permission";
import { Pokemon } from "./Entities/Pokemon";
import { Service } from "./Entities/Service";
import { Trainer } from "./Entities/Trainer";
import { User } from "./Entities/User";

export async function setupDatabase(): Promise<void> {
    const logger = getLogger("Database");

    logger.info("Initializing database");

    useContainer(Container);

    logger.info("Registered di container with orm");

    try {
        await createConnection({
            "type": "postgres",
            "host": "localhost",
            "port": 5432,
            "username": "tidobot",
            "password": "test",
            "database": "tidobot",
            "synchronize": true,
            "entities": [
                BadWord, Channel, ChannelSettings, Chatter, ChatterPermission, Command, Counter, DisabledModule, DomainFilter,
                Group, GroupPermission, List, ListItem, News, Permission, Pokemon, Service, Trainer, User
            ]
        });
        logger.info("Connected to the database");
    } catch (error) {
        logError(logger, error, "Failed to connect to the database", true);
        process.exit(1);
    }
}