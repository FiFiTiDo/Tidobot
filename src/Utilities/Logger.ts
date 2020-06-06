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

export function logError(logger: Logger, error: Error, message?: string, fatal = false) {
    const func = fatal ? logger.fatal : logger.error;

    if (message) {
        func(message);
        func("Caused by: " + error.message);
    } else {
        func(error.message);
    }
    func(error.stack);
}