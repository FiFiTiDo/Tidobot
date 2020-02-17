/**
 * The raw dictionary object.
 *
 * Used for: [[Dictionary]]
 */
import * as path from "path";
import * as fs from "fs";
import * as util from "util";

export interface IDictionary {
    [key: string]: any
}

/** @ignore */
export function normalizeSegment(seg: string): any {
    let num = Number(seg);
    return isNaN(num) ? seg : num;
}

/** @ignore */
export function getPathSegments(key: string) {
    let segments = [];

    let segment = "";
    for (let i = 0; i < key.length; i++) {
        let curr = key.charAt(i);
        let next = key.charAt(i + 1);

        if (curr === '\\' && next === '.') {
            segment += '.';
            i++;
            continue;
        }

        if (curr === '.' && segment.length > 0) {
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
    private dict: IDictionary;

    /**
     * Constructor for the Dictionary class
     *
     * @param initial The initial dictionary values
     */
    constructor(initial: IDictionary = {}) {
        this.dict = initial;
    }

    get(key: string): any {
        let segs = getPathSegments(key);
        let curr = this.dict;

        for (let seg of segs) {
            if (!(curr instanceof Object)) throw new Error("Key not found: " + key);
            if (!curr.propertyIsEnumerable(seg)) throw new Error("Key not found: " + key);

            curr = curr[seg];
        }

        return curr;
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
     * let test = dict.get('example.foo'); // "bar"
     * ```
     *
     * @param key The key of the element to retrieve
     * @param def The default value
     *
     * @returns The value located at the key or the default value if the key is not found
     */
    getOrDefault(key: string, def: any = null): any {
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
     * dict.put('example.foo', 'bar');
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
    put(key: string, value: any): void {
        let segs = getPathSegments(key);
        let curr = this.dict;

        for (let i = 0; i < segs.length - 1; i++) {
            let seg = segs[i];

            if (!curr.propertyIsEnumerable(seg)) curr[seg] = {};

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
     * dict.remove('example.foo'); // Removes
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
    remove(key: string) {
        let segs = getPathSegments(key);
        let curr = this.dict;

        for (let i = 0; i < segs.length - 1; i++) {
            let seg = segs[i];

            if (!(curr instanceof Object)) return;
            if (!curr.propertyIsEnumerable(seg)) return;

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
     * let test1 = dict.exists('example.foo'); // True
     * let test2 = dict.exists('not.a.key');   // False
     * ```
     *
     * @param key The key of the element to retrieve
     *
     * @returns The value located at the key or the default value if the key is not found
     */
    exists(key: string): boolean {
        let segs = getPathSegments(key);
        let curr = this.dict;

        for (let seg of segs) {
            if (!(curr instanceof Object)) return false;
            if (!curr.propertyIsEnumerable(seg)) return false;

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
    contains(value: any): boolean {
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
     * @returns The key of the value or null if it's not found
     */
    keyOf(value: any): string {
        if (!this.contains(value)) return null;

        let index = Object.values(this.dict).indexOf(value);
        return Object.keys(this.dict)[index];
    }

    /**
     * The function is just a way to retrieve the raw object
     *
     * @returns An object
     */
    all() {
        return this.dict;
    }

    merge(dict: Dictionary) {
        this.dict = Object.assign(this.dict, dict);
    }
}

/**
 * Parses a file's contents into whatever the [[FileDictionaryParser]] should put in the dictionary
 */
export type FileParser = (contents: string) => any;

/**
 * Parses a directory of files into a [[Dictionary]],
 * used to load configuration or language files.
 */
export class FileDictionaryParser {
    static async parse(directory: string, fileParser: FileParser): Promise<Dictionary> {
        const dictionary = new Dictionary();
        const base_path = path.resolve(process.cwd(), directory);

        let entries = await util.promisify(fs.readdir).call(fs, base_path);
        for (let entry of entries) {
            let file = path.resolve(base_path, entry);
            let stats = await util.promisify(fs.lstat).call(fs, file);

            if (stats.isDirectory()) {
                let sub = await FileDictionaryParser.parse(file, fileParser);
                dictionary.put(entry, sub.all());
            } else {
                let buffer = await util.promisify(fs.readFile).call(fs, base_path + '/' + entry);
                let parsed = fileParser(buffer.toString());

                dictionary.put(entry.substring(0, entry.lastIndexOf('.')), parsed);
            }
        }

        return dictionary;
    }

    static parseSync(directory: string, fileParser: FileParser): Dictionary {
        const dictionary = new Dictionary();
        const base_path = path.resolve(process.cwd(), directory);

        let entries = fs.readdirSync(base_path);
        for (let entry of entries) {
            let file = path.resolve(base_path, entry);
            let stats = fs.lstatSync(file);

            if (stats.isDirectory()) {
                let sub = FileDictionaryParser.parseSync(file, fileParser);
                dictionary.put(entry, sub.all());
            } else {
                let buffer = fs.readFileSync(file);
                let parsed = fileParser(buffer.toString());

                dictionary.put(entry.substring(0, entry.lastIndexOf('.')), parsed);
            }
        }

        return dictionary;
    }
}