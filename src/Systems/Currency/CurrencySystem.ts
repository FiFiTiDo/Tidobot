import { Channel } from "../../Database/Entities/Channel";
import CurrencyModule from "../../Modules/CurrencyModule";
import { pluralize } from "../../Utilities/functions";
import System from "../System";
import * as util from "util";
import { Service } from "typedi";

@Service()
export class CurrencySystem extends System {
    constructor() {
        super("Currency");
    }

    getSingularName(channel: Channel): string {
        return channel.settings.get(CurrencyModule.settings.singularCurrencyName);
    }

    getPluralName(channel: Channel): string {
        return channel.settings.get(CurrencyModule.settings.pluralCurrencyName);
    }

    formatAmount(amount: number, channel: Channel): string {
        const singular = this.getSingularName(channel);
        const plural = this.getPluralName(channel);

        return util.format("%d %s", amount, pluralize(amount, singular, plural));
    }
}