import { GenericObject } from "./Interfaces/GenericObject";

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

export class Dot {
    
    /**
     * This function is used to get a value out of the dictionary.
     * It supports the use of dot notation in the key
     *
     * Example of dot notation:
     * ```typescript
     * let object = {
     *     hello: "world",
     *     example: {
     *         foo: "bar"
     *     }
     * });
     * let test = Dot.get(object, "example.foo"); // "bar"
     * ```
     *
     * @param key The key of the element to retrieve
     * 
     * @throws Error when key is not found
     *
     * @returns The value located at the key
     */
    static get<T>(object: GenericObject, key: string): T {
        const segs = getPathSegments(key);
        let curr = object;
    
        for (const seg of segs) {
            if (!(curr instanceof Object)) throw new Error("Key not found: " + key);
            if (!Object.prototype.propertyIsEnumerable.call(curr, seg)) throw new Error("Key not found: " + key);
    
            curr = curr[seg];
        }
    
        return curr as T;
    }

    /**
     * Get a value from the object using dot notation or return the default value as specified
     * 
     * @See Dot.get(GenericObject, string)
     * 
     * @param object The object to retreive the value from
     * @param key    The key of the element to retrieve
     * @param def    The default value if the key doesn't exist
     * 
     * @returns The value located at the key or the default value if the key is not found
     */
    static getOrDefault<T>(object: GenericObject, key: string, def: T = null): T {
        try {
            return this.get(object, key);
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
     * let object = {}
     * Dot.put(object, "example.foo", "bar");
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
     * @param object The object to add the key value pair to
     * @param key    The key of the element to retrieve
     * @param value  The value to put into the dictionary
     */
    static put<T>(object: GenericObject, key: string, value: T): void {
        const segs = getPathSegments(key);
        let curr = object;

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
     * let object = {
     *     hello: "world",
     *     example: {
     *         foo: "bar"
     *     }
     * });
     * Dot.remove(object, "example.foo"); // Removes
     * ```
     * The resulting json would look like:
     * ```json
     * {
     *     "hello": "world",
     *     "example": {}
     * }
     * ```
     *
     * @param object The object to remove the key from
     * @param key    The key name
     */
    static remove(object: GenericObject, key: string): void {
        const segs = getPathSegments(key);
        let curr = object;

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
     * let object = {
     *     hello: "world",
     *     example: {
     *         foo: "bar"
     *     }
     * });
     * let test1 = Dot.exists(object, "example.foo"); // True
     * let test2 = Dot.exists(object, "not.a.key");   // False
     * ```
     *
     * @param object The object to check
     * @param key    The key of the element to retrieve
     *
     * @returns The value located at the key or the default value if the key is not found
     */
    static exists(object: GenericObject, key: string): boolean {
        const segs = getPathSegments(key);
        let curr = object;

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
     * @param object The object to check
     * @param value  The value to look for
     *
     * @returns If the value is in the dictionary
     */
    static contains<T>(object: GenericObject, value: T): boolean {
        return Object.values(object).indexOf(value) !== -1;
    }

    /**
     * This is used to find the key of a specified value.
     *
     * NOTE: This does NOT check recursively, this only checks to see
     * if it exists in the top level object.
     *
     * @param object The object to check
     * @param value  The value to look for the key of
     *
     * @returns The key of the value or null if it"s not found
     */
    static keyOf<T>(object: GenericObject, value: T): string {
        if (!this.contains(object, value)) return null;

        const index = Object.values(object).indexOf(value);
        return Object.keys(object)[index];
    }
}