import Dictionary, {FileDictionaryParser} from "./Dictionary";
import YAML from "yaml"
import * as util from "util"

export default class Translator {
    private readonly translations: Dictionary;

    constructor(directory = "lang") {
        this.translations = FileDictionaryParser.parseSync(directory, YAML.parse);
    }

    getLanguage(language = "en"): Dictionary {
        if (!this.translations.exists(language))
            return null;

        return new Dictionary(this.translations.getOrDefault(language));
    }

    get(key: string): any {
        return this.getLanguage().getOrDefault(key);
    }

    translate(key: string, ...args: any[]) {
        return util.format(this.get(key), ...args);
    }
}