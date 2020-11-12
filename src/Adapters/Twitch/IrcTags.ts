import _ from "lodash";

export class IrcTags {
    private readonly data: { [key: string]: string } = {}

    get(key: string, defVal = undefined): string {
        return this.data[key] || defVal;
    }

    put(key: string, value: string): void {
        this.data[key] = value;
    }

    containsKey(key: string): boolean {
        return _.has(this.data, key);
    }

    static parse(input: string): IrcTags {
        const tags = new IrcTags();
        const pairs = input.substr(1).split(";").map(pairStr => pairStr.split("="));
        for (const [key, value] of pairs) tags.put(key, value);
        return tags;
    }
}