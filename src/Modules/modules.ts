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
import GameModule from "./GameModule";

export function getAllModules(): AbstractModule[] {
    return [
        Container.get(ConfirmationModule), Container.get(PermissionModule), Container.get(GroupsModule), Container.get(SettingsModule), 
        Container.get(GeneralModule), Container.get(CustomCommandModule), Container.get(ListModule), Container.get(PollsModule), 
        Container.get(CounterModule), Container.get(FunModule), Container.get(NewsModule), Container.get(RaffleModule), 
        Container.get(CurrencyModule), Container.get(FilterModule), Container.get(BettingModule), Container.get(TidobotModule), 
        Container.get(UserModule), Container.get(QueueModule), Container.get(PokemonModule), Container.get(GamblingModule),
        Container.get(GameModule)
    ];
}