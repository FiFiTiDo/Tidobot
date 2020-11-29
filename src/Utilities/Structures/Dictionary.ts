/**
 * The raw dictionary object.
 *
 * Used for: [[Dictionary]]
 */
import * as path from "path";
import * as fs from "fs";
import * as util from "util";
import { GenericObject } from "../Interfaces/GenericObject";
import { Dot } from "../DotObject";

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
        return Dot.get(this.dict, key);
    }

    getOrDefault<T>(key: string, def: T = null): T {
        return Dot.getOrDefault(this.dict, key, def);
    }

    put<T>(key: string, value: T): void {
        Dot.put(this.dict, key, value);
    }

    remove(key: string): void {
        Dot.remove(this.dict, key);
    }

    exists(key: string): boolean {
        return Dot.exists(this.dict, key);
    }

    contains<T>(value: T): boolean {
        return Dot.contains(this.dict, value);
    }

    keyOf<T>(value: T): string {
        return Dot.keyOf(this.dict, value);
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