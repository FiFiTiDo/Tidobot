import {ClientOpts, RedisClient} from "redis";
import {Deserializer, Serializable} from "./Serializable";
import {promisify} from "util";

export default class Cache {
    private readonly client: RedisClient;

    constructor(opts: ClientOpts) {
        this.client = new RedisClient(opts);
        this.exists = promisify(this.client.exists).bind(this.client);
    }

    async exists(key: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.client.exists(key, (err, reply) => {
                if (err)
                    reject(err);
                else
                    resolve(reply !== 0);
            })
        });
    }

    async get(key: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.client.get(key, (err, reply) => {
                if (err)
                    reject(err);
                else
                    resolve(reply);
            })
        });
    }

    async getSerializable<T extends Serializable>(key: string, deserializer: Deserializer<T>): Promise<T> {
        return deserializer.deserialize(await this.get(key));
    }

    async set(key: string, raw_value: string | Serializable): Promise<void> {
        let value = typeof raw_value === "string" ? raw_value : raw_value.serialize();
        return new Promise((resolve, reject) => {
            this.client.set(key, value, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            })
        });
    }

    async setex(key: string, seconds: number, raw_value: string | Serializable) {
        let value = typeof raw_value === "string" ? raw_value : raw_value.serialize();
        return new Promise((resolve, reject) => {
            this.client.setex(key, seconds, value, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            })
        });
    }

    async retrieve(key: string, seconds: number, producer: () => string | Promise<string>) {
        if (await this.exists(key)) {
            return await this.get(key);
        }

        let value = producer();
        if (value instanceof Promise) value = await value;
        await this.setex(key, seconds, value);
        return value;
    }

    async retrieveSerializable<T extends Serializable>(key: string, seconds: number, deserializer: Deserializer<T>, producer: () => T | Promise<T>) {
        return deserializer.deserialize(await this.retrieve(key, seconds, async () => {
            let value = producer();
            if (value instanceof Promise) value = await value;
            return value.serialize();
        }))
    }

    async* scan(pattern: string) {
        const scan = promisify(this.client.scan).bind(this.client);
        let cursor = '0';

        do {
            const reply = await scan(cursor, 'MATCH', pattern);

            cursor = reply[0];
            yield reply[1];
        } while (cursor !== '0');
    }

    async findKeys(pattern: string) {
        let found = [];
        for await (let keySet of this.scan(pattern))
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
            })
        });
    }

    async delMatches(pattern: string) {
        let ops = [];
        for await (let keySet of this.scan(pattern)) {
            for (let key of keySet) {
                ops.push(this.del(key));
            }
        }
        return Promise.all(ops);
    }
}