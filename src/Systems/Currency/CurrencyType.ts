import { pluralize } from "../../Utilities/functions";
import * as util from "util";
import { Channel } from "../../Database/Entities/Channel";
import CurrencyModule from "../../Modules/CurrencyModule";

export class CurrencyType {
    public readonly singular: string;
    public readonly plural: string;

    constructor(channel: Channel) {
        this.singular = channel.settings.get(CurrencyModule.settings.singularCurrencyName);
        this.plural = channel.settings.get(CurrencyModule.settings.pluralCurrencyName);
    }

    public formatAmount(amount: number): string {
        return util.format("%d %s", amount, pluralize(amount, this.singular, this.plural));
    }

    public static get(channel: Channel): CurrencyType {
        return new CurrencyType(channel);
    }
}