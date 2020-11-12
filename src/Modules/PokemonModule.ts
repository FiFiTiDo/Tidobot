import AbstractModule, {Symbols} from "./AbstractModule";
import Command from "../Systems/Commands/Command";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {Float, Integer, SettingType} from "../Systems/Settings/Setting";
import {Response} from "../Chat/Response";
import {ChatterArg} from "../Systems/Commands/Validation/Chatter";
import {getLogger} from "../Utilities/Logger";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ChannelArg, makeEventReducer, ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {TranslateMessageInputError} from "../Systems/Commands/Validation/ValidationErrors";
import {GameService, TrainerData, WinState} from "../Services/Pokemon/GameService";
import { Channel } from "../Database/Entities/Channel";
import { Chatter } from "../Database/Entities/Chatter";
import { Service } from "typedi";
import { StringArg } from "../Systems/Commands/Validation/String";
import Event from "../Systems/Event/Event";
import { CommandEvent } from "../Systems/Commands/CommandEvent";
import _ from "lodash";

export const MODULE_INFO = {
    name: "Pokemon",
    version: "1.2.0",
    description: "Play pokemon using other users as your team's pokemon"
};

const logger = getLogger(MODULE_INFO.name);

const TrainerSender = makeEventReducer(async event => {
    const message = event.extra.get(CommandEvent.EXTRA_MESSAGE);
    const chatter = message.chatter;
    const trainer = chatter.trainer;
    const team = trainer?.team ?? [];
    return {chatter, trainer, team};
});

class TrainerDataArg {
    static type = "trainer";
    private static chatterArg = new ChatterArg();

    static async convert(input: string, name: string, column: number, event: Event): Promise<TrainerData> {
        const chatter = await this.chatterArg.convert(input, name, column, event);
        if (chatter.trainer === undefined)
            throw new TranslateMessageInputError("pokemon:error.no-trainer", {username: input});
        return { chatter, trainer: chatter.trainer, team: chatter.trainer.team };
    }
}

@Service()
class PokemonCommand extends Command {
    constructor(private readonly gameService: GameService) {
        super("pokemon", "<team|throw|release|release-all|fight|stats|top>", ["poke", "pm"]);
    }

    @CommandHandler(/^(pokemon|poke|pm) team$/, "pokemon team", 1)
    @CheckPermission(() => PokemonModule.permissions.playPokemon)
    async team(event: Event, @ResponseArg response: Response, @Sender sender, @TrainerSender {team}: TrainerData): Promise<void> {
        return response.message("pokemon:team", {username: sender.name, team: team.map(pkmn => pkmn.toString())});
    }

    @CommandHandler(/^(pokemon|poke|pm) throw/, "pokemon throw [target]", 1)
    @CheckPermission(() => PokemonModule.permissions.playPokemon)
    async throw(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel, @TrainerSender trainerData: TrainerData,
        @Argument(new ChatterArg(), "target", false) chatter: Chatter = null, @Sender sender: Chatter
    ): Promise<void> {
        const {team} = trainerData;
        const maxTeamSize = channel.settings.get(PokemonModule.settings.maxTeamSize);
        if (team.length >= maxTeamSize) return response.message("pokemon:error.full");

        const pkmn = chatter === null ?
            this.gameService.generateRandom(trainerData) :
            this.gameService.generate(chatter.user.name, trainerData);
        if (!pkmn.present) return response.message("pokemon:error.already-caught");

        try {
            const pokemon = pkmn.value.toFullString();
            let result: string;

            if (await this.gameService.attemptCatch(channel, pkmn.value)) {
                result = await response.translate("pokemon:catch.success", {nature: pkmn.value.nature});
            } else {
                result = _.sample(await response.getTranslation("pokemon:catch.failed"));
            }

            return await response.message("pokemon:catch.full", {username: sender.user.name, pokemon, result});
        } catch (e) {
            return await response.genericErrorAndLog(e, logger);
        }
    }

    @CommandHandler(/^(pokemon|poke|pm) rel(ease)?/, "pokemon release [pokemon]", 1)
    @CheckPermission(() => PokemonModule.permissions.playPokemon)
    async release(
        event: Event, @ResponseArg response: Response, @Sender sender: Chatter,
        @TrainerSender {team}: TrainerData, @Argument(StringArg, "pokemon", false) name: string = null
    ): Promise<void> {
        const specific = name === null;
        const pkmn = specific ? this.gameService.findMonByName(name, team) : this.gameService.getRandomMon(team);

        if (!pkmn.present) return response.message(specific ? "pokemon:error.not-caught" : "pokemon:error.empty");

        return pkmn.value.remove().then(() => response.message("pokemon:released", {
            username: sender.user.name, pokemon: pkmn.value.toFullString()
        })).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(pokemon|poke|pm) rel(ease)?-all/, "pokemon release-all", 1)
    @CheckPermission(() => PokemonModule.permissions.playPokemon)
    async releaseAll(
        event: Event, @ResponseArg response: Response, @Sender sender: Chatter, @TrainerSender {team}: TrainerData
    ): Promise<void> {
        const pokemon = team.map(pkmn => pkmn.name).join(", ");
        return this.gameService.releaseTeam(team)
            .then(() => response.message("pokemon.released", {username: sender.user.name, pokemon}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(pokemon|poke|pm) fight/, "pokemon fight <trainer>", 1)
    @CheckPermission(() => PokemonModule.permissions.playPokemon)
    async fight(
        event: Event, @ResponseArg response: Response, @Sender sender: Chatter, 
        @TrainerSender self: TrainerData, @Argument(TrainerDataArg, "trainer") target: TrainerData
    ): Promise<void> {
        if (sender.is(target.chatter)) return response.message("pokemon:error.self");
        if (self.team.length < 1) return response.message("pokemon:error.no-team-self");
        if (target.team.length < 1) return response.message("pokemon:error.no-team-target");

        let resp;
        try {
            resp = await this.gameService.attemptFight(self, target);
        } catch (e) {
            return await response.genericErrorAndLog(e, logger);
        }
        const {winner, leveledUp, selfMon, targetMon} = resp;

        let result: string;
        switch (winner) {
            case WinState.SELF:
                result = await response.translate("pokemon:battle.win");
                break;
            case WinState.TARGET:
                result = await response.translate("pokemon:battle.lose");
                break;
            case WinState.DRAW:
                result = await response.translate("pokemon:battle.draw");
                break;
        }

        if (leveledUp.length > 0)
            result += " " + await response.translate("pokemon:battle.level-up", {pokemon: leveledUp.join(", ")});

        await response.message("pokemon:battle.base", {
            self: sender.user.name, selfMon: selfMon.toString(),
            target: target.chatter.user.name, targetMon: targetMon.toString(),
            result
        });
    }

    @CommandHandler(/^(pokemon|poke|pm) stats/, "pokemon stats [trainer]", 1)
    @CheckPermission(event => event.extra.get(CommandEvent.EXTRA_ARGUMENTS).length < 1 ? PokemonModule.permissions.viewStats : PokemonModule.permissions.viewOthersStats)
    async stats(
        event: Event, @ResponseArg response: Response, @TrainerSender sender: TrainerData,
        @Argument(TrainerDataArg, "trainer", false) target: TrainerData = null
    ): Promise<void> {
        const {chatter, trainer: {won, lost, draw}} = target ?? sender;
        let ratio = (won / (won + lost + draw)) * 100;
        if (isNaN(ratio)) ratio = 0;
        return response.message("pokemon:stats", {username: chatter.user.name, ratio, won, lost, draw});
    }

    @CommandHandler(/^(pokemon|poke|pm) top/, "pokemon top", 1)
    @CheckPermission(() => PokemonModule.permissions.viewStats)
    async top(event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel): Promise<void> {
        return this.gameService.getAllTrainerStats(channel)
            .then(stats => response.message("pokemon:top", {
                trainers: stats
                    .sort((a, b) => b.teamLevel - a.teamLevel).slice(0, 10)
                    .map(trainer => `${trainer.name}(${trainer.teamLevel})`).join(", ")
            })).catch(e => response.genericErrorAndLog(e, logger));
    }
}

@Service()
export default class PokemonModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        playPokemon: new Permission("pokemon.play", Role.NORMAL),
        viewStats: new Permission("pokemon.stats", Role.NORMAL),
        viewOthersStats: new Permission("pokemon.stats.other", Role.MODERATOR)
    }
    static settings = {
        maxTeamSize: new Setting("pokemon.max-team-size", 5 as Integer, SettingType.INTEGER),
        baseCatchChance: new Setting("pokemon.chance.base-catch", 0.3 as Float, SettingType.FLOAT),
        shinyChance: new Setting("pokemon.chance.shiny", 0.05 as Float, SettingType.FLOAT),
        rusChance: new Setting("pokemon.chance.rus", 0.01 as Float, SettingType.FLOAT),
        drawChance: new Setting("pokemon.chance.draw", 4 as Integer, SettingType.INTEGER),
        minLevel: new Setting("pokemon.level.min", 1 as Integer, SettingType.INTEGER),
        maxLevel: new Setting("pokemon.level.max", 100 as Integer, SettingType.INTEGER)
    }

    constructor(pokemonCommand: PokemonCommand) {
        super(PokemonModule);

        this.registerCommand(pokemonCommand);
        this.registerPermissions(PokemonModule.permissions);
        this.registerSettings(PokemonModule.settings);
    }
}