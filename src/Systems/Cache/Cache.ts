import {RedisClient, RedisError} from "redis";
import {Deserializer, Serializable} from "../../Utilities/Patterns/Serializable";
import {promisify} from "util";
import Config from "../Config/Config";
import CacheConfig from "../Config/ConfigModels/CacheConfig";
import System from "../System";

export default class Cache extends System {
    private static instance: Cache = null;

    constructor(private readonly client: RedisClient) {
        super("Cache");
        client.on("error", (e: RedisError) => {
            if (e.message.indexOf("ECONNREFUSED") !== -1) {
                this.logger.fatal("Unable to connect to Redis server");
                this.logger.fatal("Caused by: " + e.message);
                this.logger.fatal(e.stack);
                process.exit(1);
            } else {
                this.logger.error(e.message);
                this.logger.error(e.stack);
            }
        });
        this.logger.info("System initialized");
    }

    public static async getInstance(): Promise<Cache> {
        if (this.instance === null)
            this.instance = await Cache.create();

        return this.instance;
    }

    async exists(key: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.client.exists(key, (err, reply) => {
                if (err)
                    reject(err);
                else
                    resolve(reply !== 0);
            });
        });
    }

    async get(key: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.client.get(key, (err, reply) => {
                if (err)
                    reject(err);
                else
                    resolve(reply);
            });
        });
    }

    async getSerializable<T extends Serializable>(key: string, deserializer: Deserializer<T>): Promise<T> {
        return deserializer.deserialize(await this.get(key));
    }

    async set(key: string, rawValue: string | Serializable): Promise<void> {
        const value = typeof rawValue === "string" ? rawValue : rawValue.serialize();
        return new Promise((resolve, reject) => {
            this.client.set(key, value, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async setex(key: string, seconds: number, rawValue: string | Serializable): Promise<void> {
        const value = typeof rawValue === "string" ? rawValue : rawValue.serialize();
        return new Promise((resolve, reject) => {
            this.client.setex(key, seconds, value, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async retrieve(key: string, seconds: number, producer: () => string | Promise<string>): Promise<string> {
        if (await this.exists(key)) return await this.get(key);

        let value = producer();
        if (value instanceof Promise) value = await value;
        await this.setex(key, seconds, value);
        return value;
    }

    async retrieveSerializable<T extends Serializable>(key: string, seconds: number, deserializer: Deserializer<T>, producer: () => T | Promise<T>): Promise<T> {
        return deserializer.deserialize(await this.retrieve(key, seconds, async () => {
            let value = producer();
            if (value instanceof Promise) value = await value;
            return value.serialize();
        }));
    }

    async* scan(pattern: string): AsyncIterable<string> {
        const scan = promisify(this.client.scan).bind(this.client);
        let cursor = "0";

        do {
            const reply = await scan(cursor, "MATCH", pattern);

            cursor = reply[0];
            yield reply[1];
        } while (cursor !== "0");
    }

    async findKeys(pattern: string): Promise<string[]> {
        let found = [];
        for await (const keySet of this.scan(pattern))
            found = found.concat(keySet);
        return found;
    }

    async del(key: string): Promise<number> {
        return new Promise((resolve, reject) => {
            this.client.del(key, (err, reply) => {
                if (err)
                    reject(err);
                else
                    resolve(reply);
            });
        });
    }

    async delMatches(pattern: string): Promise<number[]> {
        const ops = [];
        for await (const keySet of this.scan(pattern))
            for (const key of keySet)
                ops.push(this.del(key));
        return Promise.all(ops);
    }

    static async create() {
        const config = await Config.getInstance().getConfig(CacheConfig);
        const client = new RedisClient(config.redis);
        return new Cache(client);
    }
}