import {Container} from "inversify";
import ConfirmationModule, {Confirmation, ConfirmationFactory} from "./ConfirmationModule";
import CommandModule from "./CommandModule";
import PermissionModule from "./PermissionModule";
import GroupsModule from "./GroupsModule";
import SettingsModule from "./SettingsModule";
import GeneralModule from "./GeneralModule";
import CustomCommandModule from "./CustomCommandModule";
import ListModule from "./ListModule";
import PollsModule from "./PollsModule";
import CounterModule from "./CounterModule";
import FunModule from "./FunModule";
import ExpressionModule from "./ExpressionModule";
import NewsModule from "./NewsModule";
import RaffleModule from "./RaffleModule";
import CurrencyModule from "./CurrencyModule";
import FilterModule from "./FilterModule";
import BettingModule from "./BettingModule";
import TidobotModule from "./TidobotModule";
import AbstractModule from "./AbstractModule";
import UserModule from "./UserModule";
import symbols from "../symbols";

export const ALL_MODULES = [
    ConfirmationModule, CommandModule, PermissionModule, GroupsModule, SettingsModule, GeneralModule, CustomCommandModule,
    ListModule, PollsModule, CounterModule, FunModule, ExpressionModule, NewsModule, RaffleModule, CurrencyModule,
    FilterModule, BettingModule, TidobotModule, UserModule
];

export const ALL_MODULES_KEY = Symbol("All Modules");

export function createBindings(container: Container): void {
    for (const module of ALL_MODULES) container.bind<any>(module).toSelf();
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