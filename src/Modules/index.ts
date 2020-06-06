import {Container} from "inversify";
import ConfirmationModule, {Confirmation, ConfirmationFactory} from "./ConfirmationModule";
import PermissionModule from "./PermissionModule";
import GroupsModule from "./GroupsModule";
import SettingsModule from "./SettingsModule";
import GeneralModule from "./GeneralModule";
import CustomCommandModule from "./CustomCommandModule";
import ListModule from "./ListModule";
import PollsModule from "./PollsModule";
import CounterModule from "./CounterModule";
import FunModule from "./FunModule";
import NewsModule from "./NewsModule";
import RaffleModule from "./RaffleModule";
import CurrencyModule from "./CurrencyModule";
import FilterModule from "./FilterModule";
import BettingModule from "./BettingModule";
import TidobotModule from "./TidobotModule";
import AbstractModule from "./AbstractModule";
import UserModule from "./UserModule";
import symbols from "../symbols";
import {autoProvide} from "inversify-binding-decorators";
import QueueModule from "./QueueModule";
import PokemonModule from "./PokemonModule";
import GamblingModule from "./GamblingModule";

export const ALL_MODULES = [
    ConfirmationModule, PermissionModule, GroupsModule, SettingsModule, GeneralModule, CustomCommandModule, ListModule,
    PollsModule, CounterModule, FunModule, NewsModule, RaffleModule, CurrencyModule, FilterModule, BettingModule,
    TidobotModule, UserModule, QueueModule, PokemonModule, GamblingModule
];

export const ALL_MODULES_KEY = Symbol("All Modules");

export function createBindings(container: Container): void {
    autoProvide(container, ALL_MODULES);
    container.bind<AbstractModule[]>(ALL_MODULES_KEY).toDynamicValue(ctx => {
        const modules = [];
        for (const module of ALL_MODULES)
            modules.push(ctx.container.get<any>(module));
        return modules;
    });
    container.bind<ConfirmationFactory>(symbols.ConfirmationFactory).toFactory<Promise<Confirmation>>(ctx => (message, prompt, seconds): Promise<Confirmation> => {
        return ctx.container.get<ConfirmationModule>(ConfirmationModule).make(message, prompt, seconds);
    });
}