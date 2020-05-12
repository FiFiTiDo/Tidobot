/**
 * The raw dictionary object.
 *
 * Used for: [[Dictionary]]
 */
import * as path from "path";
import * as fs from "fs";
import * as util from "util";
import GenericObject from "../Interfaces/GenericObject";

/** @ignore */
export function normalizeSegment(seg: string): string | number {
    const num = Number(seg);
    return isNaN(num) ? seg : num;
}

/** @ignore */
export function getPathSegments(key: string): string[] {
    const segments = [];

    let segment = "";
    for (let i = 0; i < key.length; i++) {
        const curr = key.charAt(i);
        const next = key.charAt(i + 1);

        if (curr === "\\" && next === ".") {
            segment += ".";
            i++;
            continue;
        }

        if (curr === "." && segment.length > 0) {
            segments.push(normalizeSegment(segment));
            segment = "";
            continue;
        }

        segment += curr;
    }
    if (segment.length > 0) segments.push(normalizeSegment(segment));

    return segments;
}

/**
 * A generic dictionary class to make configs and other data easier to manage with dot notation.
 */
export default class Dictionary {
    private dict: GenericObject;

    /**
     * Constructor for the Dictionary class
     *
     * @param initial The initial dictionary values
     */
    constructor(initial: GenericObject = {}) {
        this.dict = initial;
    }

    get<T>(key: string): T {
        const segs = getPathSegments(key);
        let curr = this.dict;

        for (const seg of segs) {
            if (!(curr instanceof Object)) throw new Error("Key not found: " + key);
            if (!Object.prototype.propertyIsEnumerable.call(curr, seg)) throw new Error("Key not found: " + key);

            curr = curr[seg];
        }

        return curr as T;
    }

    /**
     * This function is used to get a value out of the dictionary.
     * It supports the use of dot notation in the key
     *
     * Example of dot notation:
     * ```typescript
     * let dict = new Dictionary({
     *     hello: "world",
     *     example: {
     *         foo: "bar"
     *     }
     * });
     * let test = dict.get("example.foo"); // "bar"
     * ```
     *
     * @param key The key of the element to retrieve
     * @param def The default value
     *
     * @returns The value located at the key or the default value if the key is not found
     */
    getOrDefault<T>(key: string, def: T = null): T {
        try {
            return this.get(key);
        } catch (e) {
            return def;
        }
    }

    /**
     * This function is used to put a value into the dictionary.
     * It supports the use of dot notation in the key
     *
     * By executing the following code:
     * ```typescript
     * let dict = new Dictionary();
     * dict.put("example.foo", "bar");
     * ```
     * The resulting json would look like:
     * ```json
     * {
     *     "example": {
     *         "foo": "bar"
     *     }
     * }
     * ```
     *
     * @param key   The key of the element to retrieve
     * @param value The value to put into the dictionary
     */
    put<T>(key: string, value: T): void {
        const segs = getPathSegments(key);
        let curr = this.dict;

        for (let i = 0; i < segs.length - 1; i++) {
            const seg = segs[i];

            if (!Object.prototype.propertyIsEnumerable.call(curr, seg)) curr[seg] = {};

            curr = curr[seg];
        }

        curr[segs[segs.length - 1]] = value;
    }

    /**
     * This function is used to get a value out of the dictionary.
     * It supports the use of dot notation in the key
     *
     * By executing the following code:
     * ```typescript
     * let dict = new Dictionary({
     *     hello: "world",
     *     example: {
     *         foo: "bar"
     *     }
     * });
     * dict.remove("example.foo"); // Removes
     * ```
     * The resulting json would look like:
     * ```json
     * {
     *     "hello": "world",
     *     "example": {}
     * }
     * ```
     *
     * @param key The key name
     */
    remove(key: string): void {
        const segs = getPathSegments(key);
        let curr = this.dict;

        for (let i = 0; i < segs.length - 1; i++) {
            const seg = segs[i];

            if (!(curr instanceof Object)) return;
            if (!Object.prototype.propertyIsEnumerable.call(curr, seg)) return;

            curr = curr[seg];
        }

        delete curr[segs[segs.length - 1]];
    }

    /**
     * This function is used to check if a key exists in the dictionary
     * It supports the use of dot notation in the key
     *
     * Example of dot notation:
     * ```typescript
     * let dict = new Dictionary({
     *     hello: "world",
     *     example: {
     *         foo: "bar"
     *     }
     * });
     * let test1 = dict.exists("example.foo"); // True
     * let test2 = dict.exists("not.a.key");   // False
     * ```
     *
     * @param key The key of the element to retrieve
     *
     * @returns The value located at the key or the default value if the key is not found
     */
    exists(key: string): boolean {
        const segs = getPathSegments(key);
        let curr = this.dict;

        for (const seg of segs) {
            if (!(curr instanceof Object)) return false;
            if (!Object.prototype.propertyIsEnumerable.call(curr, seg)) return false;

            curr = curr[seg];
        }

        return true;
    }

    /**
     * This is used to see if a value exists in the dictionary
     *
     * NOTE: This does NOT check recursively, this only checks to see
     * if it exists in the top level object.
     *
     * @param value The value to look for
     *
     * @returns If the value is in the dictionary
     */
    contains<T>(value: T): boolean {
        return Object.values(this.dict).indexOf(value) !== -1;
    }

    /**
     * This is used to find the key of a specified value.
     *
     * NOTE: This does NOT check recursively, this only checks to see
     * if it exists in the top level object.
     *
     * @param value The value to look for the key of
     *
     * @returns The key of the value or null if it"s not found
     */
    keyOf<T>(value: T): string {
        if (!this.contains(value)) return null;

        const index = Object.values(this.dict).indexOf(value);
        return Object.keys(this.dict)[index];
    }

    /**
     * The function is just a way to retrieve the raw object
     *
     * @returns An object
     */
    all(): GenericObject {
        return this.dict;
    }

    merge(dict: Dictionary): void {
        this.dict = Object.assign(this.dict, dict);
    }
}

/**
 * Parses a file"s contents into whatever the [[FileDictionaryParser]] should put in the dictionary
 */
export interface FileParser<T> {
    (contents: string): T;
}

/**
 * Parses a directory of files into a [[Dictionary]],
 * used to load configuration or language files.
 */
export class FileDictionaryParser {
    static async parse<T>(directory: string, fileParser: FileParser<T>): Promise<Dictionary> {
        const dictionary = new Dictionary();
        const basePath = path.resolve(process.cwd(), directory);

        const entries = await util.promisify(fs.readdir).call(fs, basePath);
        for (const entry of entries) {
            const file = path.resolve(basePath, entry);
            const stats = await util.promisify(fs.lstat).call(fs, file);

            if (stats.isDirectory()) {
                const sub = await FileDictionaryParser.parse(file, fileParser);
                dictionary.put(entry, sub.all());
            } else {
                const buffer = await util.promisify(fs.readFile).call(fs, basePath + "/" + entry);
                const parsed = fileParser(buffer.toString());

                dictionary.put(entry.substring(0, entry.lastIndexOf(".")), parsed);
            }
        }

        return dictionary;
    }

    static parseSync<T>(directory: string, fileParser: FileParser<T>): Dictionary {
        const dictionary = new Dictionary();
        const basePath = path.resolve(process.cwd(), directory);

        const entries = fs.readdirSync(basePath);
        for (const entry of entries) {
            const file = path.resolve(basePath, entry);
            const stats = fs.lstatSync(file);

            if (stats.isDirectory()) {
                const sub = FileDictionaryParser.parseSync(file, fileParser);
                dictionary.put(entry, sub.all());
            } else {
                const buffer = fs.readFileSync(file);
                const parsed = fileParser(buffer.toString());

                dictionary.put(entry.substring(0, entry.lastIndexOf(".")), parsed);
            }
        }

        return dictionary;
    }
}