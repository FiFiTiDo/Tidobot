import winston from "winston";
import {error_format} from "./functions";

export default class Logger {
    private static instance: winston.Logger = null;

    public static get(): winston.Logger {
        if (this.instance === null) {
            this.instance = winston.createLogger({
                level: "info",
                format: winston.format.combine(
                    winston.format.timestamp(),
                    error_format()
                ),
                transports: [
                    new winston.transports.Console({
                        format: winston.format.combine(
                            winston.format.colorize(),
                            winston.format.simple()
                        )
                    }),
                    new (winston.transports as any).DailyRotateFile({
                        filename: "logs/application-%DATE%.log",
                        datePattern: "YYYY-MM-DD-HH",
                        zippedArchive: true,
                        maxSize: "20m",
                        maxFiles: "14d",
                        format: winston.format.json()
                    }),
                ]
            });
        }

        return this.instance;
    }
}