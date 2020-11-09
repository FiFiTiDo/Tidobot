import Container from "typedi";
import { createConnections, useContainer } from "typeorm";
import { getLogger, logError } from "../Utilities/Logger";

export async function setupDatabase(): Promise<void> {
    const logger = getLogger("Database");

    logger.info("Initializing database");

    useContainer(Container);

    logger.info("Registered di container with orm");

    try {
        await createConnections();
        logger.info("Connected to the database");
    } catch (error) {
        logError(logger, error, "Failed to connect to the database", true);
        process.exit(1);
    }
}