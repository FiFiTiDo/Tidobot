import ConfirmationModule from "./ConfirmationModule";
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
import QueueModule from "./QueueModule";
import PokemonModule from "./PokemonModule";
import GamblingModule from "./GamblingModule";
import Container from "typedi";

export const ALL_MODULES = [
    ConfirmationModule, PermissionModule, GroupsModule, SettingsModule, GeneralModule, CustomCommandModule, ListModule,
    PollsModule, CounterModule, FunModule, NewsModule, RaffleModule, CurrencyModule, FilterModule, BettingModule,
    TidobotModule, UserModule, QueueModule, PokemonModule, GamblingModule
];

export function getAllModules(): AbstractModule[] {
    return ALL_MODULES.map(Container.get) as AbstractModule[];
}