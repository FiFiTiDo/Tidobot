import {configure, Logger} from "log4js";

export const getLogger = configure({
    appenders: {
        everything: {type: "file", filename: "logs/application.log", maxLogSize: 10485760, backups: 3, compress: true},
        console: {type: "console"},
        consoleNoDebug: {type: "logLevelFilter", appender: "console", level: "info"}
    },
    categories: {
        default: {appenders: ["everything", process.env.DEBUG ? "console" : "consoleNoDebug"], level: "debug"}
    }
}).getLogger;

export function logError(logger: Logger, error: Error, message?: string) {
    if (message) {
        logger.error(message);
        logger.error("Caused by: " + error.message);
    } else {
        logger.error(error.message);
    }
    logger.error(error.stack);
}