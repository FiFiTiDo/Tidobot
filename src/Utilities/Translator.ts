import Dictionary, {FileDictionaryParser} from "./Structures/Dictionary";
import YAML from "yaml"
import * as util from "util"

export class TranslationKey {
    constructor(public key: string) {
    }
}

export function Key(key: string): TranslationKey {
    return new TranslationKey(key);
}

export default class Translator {
    private readonly translations: Dictionary;

    constructor(directory = "lang") {
        this.translations = FileDictionaryParser.parseSync(directory, YAML.parse);
    }

    getLanguage(): Dictionary {
        if (!this.translations.exists(process.env.LANGUAGE))
            return null;

        return new Dictionary(this.translations.get(process.env.LANGUAGE));
    }

    get<T>(key: string|TranslationKey): T {
        if (key instanceof TranslationKey) key = key.key;
        return this.getLanguage().get(key);
    }

    translate(key: string|TranslationKey, ...args: any[]): string {
        if (key instanceof TranslationKey) key = key.key;
        return util.format(this.get<string>(key), ...args);
    }
}