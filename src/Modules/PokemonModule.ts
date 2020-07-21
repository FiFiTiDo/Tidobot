import AbstractModule, {Symbols} from "./AbstractModule";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {Float, Integer, SettingType} from "../Systems/Settings/Setting";
import TrainerEntity from "../Database/Entities/TrainerEntity";
import PokemonEntity, {formatStats} from "../Database/Entities/PokemonEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import {arrayRand} from "../Utilities/ArrayUtils";
import {Response} from "../Chat/Response";
import ChannelManager from "../Chat/ChannelManager";
import {ChatterArg} from "../Systems/Commands/Validation/Chatter";
import {StringArg} from "../Systems/Commands/Validation/String";
import {getLogger} from "../Utilities/Logger";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {setting} from "../Systems/Settings/decorators";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, Channel, makeEventReducer, ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {TranslateMessageInputError} from "../Systems/Commands/Validation/ValidationErrors";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import {GameService, TrainerData, WinState} from "../Services/Pokemon/GameService";
import {ExperienceService} from "../Services/Pokemon/ExperienceService";

export const MODULE_INFO = {
    name: "Pokemon",
    version: "1.1.0",
    description: "Play pokemon using other users as your team's pokemon"
};

const logger = getLogger(MODULE_INFO.name);

const TrainerSender = makeEventReducer(async event => {
    const chatter = event.getMessage().getChatter();
    const trainer = await TrainerEntity.getByChatter(chatter);
    const team = await trainer?.team() ?? [];
    return {chatter, trainer, team};
});

class TrainerDataArg {
    private chatterArg = new ChatterArg();

    constructor(private gameService: GameService) {}

    type = "trainer";
    async convert(input: string, name: string, column: number, event: CommandEvent): Promise<TrainerData> {
        const response = event.getMessage().getResponse();
        const chatter = await this.chatterArg.convert(input, name, column, event);
        const data = await this.gameService.getTrainerData(chatter);
        return data.orElseThrow(() => new TranslateMessageInputError("pokemon:error.no-trainer", {username: input}));
    }
}

class PokemonCommand extends Command {
    constructor(private pokemonModule: PokemonModule) {
        super("pokemon", "<team|throw|release|release-all|fight|stats|top>", ["poke", "pm"]);
    }

    @CommandHandler(/^(pokemon|poke|pm) team$/, "pokemon team", 1)
    @CheckPermission("pokemon.play")
    async team(event: CommandEvent, @ResponseArg response: Response, @Sender sender, @TrainerSender {team}: TrainerData): Promise<void> {
        return response.message("pokemon:team", {username: sender.name, team: team.map(pkmn => pkmn.toString())});
    }

    @CommandHandler(/^(pokemon|poke|pm) throw/, "pokemon throw [target]", 1)
    @CheckPermission("pokemon.play")
    async throw(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @TrainerSender trainerData: TrainerData,
        @Argument(new ChatterArg(), "target", false) chatter: ChatterEntity = null, @Sender sender: ChatterEntity
    ): Promise<void> {
        const {trainer, team} = trainerData;
        const maxTeamSize = await channel.getSetting(this.pokemonModule.maxTeamSize);
        if (team.length >= maxTeamSize) return response.message("pokemon:error.full");

        const stats = chatter === null ?
            await this.pokemonModule.gameService.generateRandomStats(trainerData) :
            await this.pokemonModule.gameService.generateStats(chatter.name, trainerData);
        if (!stats.present) return response.message("pokemon:error.already-caught");

        try {
            let pokemon;
            let result;

            if (await this.pokemonModule.gameService.attemptCatch(channel, stats.value)) {
                const pkmn = await this.pokemonModule.gameService.createMonFromStats(trainer, stats.value);
                pokemon = pkmn.toFullString();
                result = await response.translate("pokemon:catch.success", {nature: pkmn.nature});
            } else {
                pokemon = formatStats(stats.value);
                result = arrayRand(await response.getTranslation("pokemon:catch.failed"));
            }

            return await response.message("pokemon:catch.full", {username: sender.name, pokemon, result});
        } catch (e) {
            return await response.genericErrorAndLog(e, logger);
        }
    }

    @CommandHandler(/^(pokemon|poke|pm) rel(ease)?/, "pokemon release [pokemon]", 1)
    @CheckPermission("pokemon.play")
    async release(
        event: CommandEvent, @ResponseArg response: Response, @Sender sender: ChatterEntity,
        @TrainerSender {trainer, team}: TrainerData, @Argument(StringArg, "pokemon", false) name: string = null
    ): Promise<void> {
        const specific = name === null;
        const pkmn = specific ?
            this.pokemonModule.gameService.findMonByName(name, team) :
            this.pokemonModule.gameService.getRandomMon(team);

        if (!pkmn.present) return response.message(specific ? "pokemon:error.not-caught" : "pokemon:error.empty");

        return pkmn.value.delete().then(() => response.message("pokemon:released", {
            username: sender.name, pokemon: pkmn.value.toFullString()
        })).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(pokemon|poke|pm) rel(ease)?-all/, "pokemon release-all", 1)
    @CheckPermission("pokemon.play")
    async releaseAll(
        event: CommandEvent, @ResponseArg response: Response, @Sender sender: ChatterEntity,
        @TrainerSender {team}: TrainerData
    ): Promise<void> {
        const pokemon = team.map(pkmn => pkmn.name).join(", ");
        return this.pokemonModule.gameService.releaseTeam(team)
            .then(() => response.message("pokemon.released", {username: sender.name, pokemon}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(pokemon|poke|pm) fight/, "pokemon fight <trainer>", 1)
    @CheckPermission("pokemon.play")
    async fight(
        event: CommandEvent, @ResponseArg response: Response, @Sender sender: ChatterEntity, @Channel channel: ChannelEntity,
        @TrainerSender self: TrainerData, @Argument(new TrainerDataArg(this.pokemonModule.gameService),"trainer") target: TrainerData
    ): Promise<void> {
        if (sender.is(target.chatter)) return response.message("pokemon:error.self");
        if (self.team.length < 1) return response.message("pokemon:error.no-team-self");
        if (target.team.length < 1) return response.message("pokemon:error.no-team-target");

        let resp;
        try {
            resp = await this.pokemonModule.gameService.attemptFight(self, target);
        } catch (e) {
            return await response.genericErrorAndLog(e, logger);
        }
        const {winner, leveledUp, selfMon, targetMon} = resp;

        let result: string;
        switch (winner) {
            case WinState.SELF: result = await response.translate("pokemon:battle.win"); break;
            case WinState.TARGET: result = await response.translate("pokemon:battle.lose"); break;
            case WinState.DRAW: result = await response.translate("pokemon:battle.draw"); break;
        }

        if (leveledUp.length > 0)
            result += " " + await response.translate("pokemon:battle.level-up", {pokemon: leveledUp.join(", ")});

        await response.message("pokemon:battle.base", {
            self: sender.name, selfMon: selfMon.toString(),
            target: target.chatter.name, targetMon: targetMon.toString(),
            result
        });
    }

    @CommandHandler(/^(pokemon|poke|pm) stats/, "pokemon stats [trainer]", 1)
    @CheckPermission(event => event.getArgumentCount() < 1 ? "pokemon.stats" : "pokemon.stats.other")
    async stats(
        event: CommandEvent, @ResponseArg response: Response, @TrainerSender sender: TrainerData,
        @Argument(new TrainerDataArg(this.pokemonModule.gameService), "trainer", false) target: TrainerData = null
    ): Promise<void> {
        const {chatter, trainer: {won, lost, draw}} = target ?? sender;
        let ratio = (won / (won + lost + draw)) * 100;
        if (isNaN(ratio)) ratio = 0;
        return response.message("pokemon:stats", {username: chatter.name, ratio, won, lost, draw})
    }

    @CommandHandler(/^(pokemon|poke|pm) top/, "pokemon top", 1)
    @CheckPermission("pokemon.stats")
    async top(event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity): Promise<void> {
        return this.pokemonModule.gameService.getAllTrainerStats(channel)
            .then(stats => response.message("pokemon:top", {trainers: stats
                .sort((a, b) => b.teamLevel - a.teamLevel).slice(0, 10)
                .map(trainer => `${trainer.name}(${trainer.teamLevel})`).join(", ")
            })).catch(e => response.genericErrorAndLog(e, logger));
    }
}

@HandlesEvents()
export default class PokemonModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    public readonly experienceService: ExperienceService;
    public readonly gameService: GameService;

    constructor(channelManager: ChannelManager) {
        super(PokemonModule);
        this.experienceService = new ExperienceService(channelManager);
        this.gameService = new GameService(this.experienceService);
    }

    @command pokemonCommand = new PokemonCommand(this);

    @permission playPokemon = new Permission("pokemon.play", Role.NORMAL);
    @permission viewStats = new Permission("pokemon.stats", Role.NORMAL);
    @permission viewOthersStats = new Permission("pokemon.stats.other", Role.MODERATOR);

    @setting maxTeamSize = new Setting("pokemon.max-team-size", 5 as Integer, SettingType.INTEGER);
    @setting baseCatchChance = new Setting("pokemon.chance.base-catch", 0.3 as Float, SettingType.FLOAT);
    @setting shinyChance = new Setting("pokemon.chance.shiny", 0.05 as Float, SettingType.FLOAT);
    @setting rusChance = new Setting("pokemon.chance.rus", 0.01 as Float, SettingType.FLOAT);
    @setting drawChance = new Setting("pokemon.chance.draw", 4 as Integer, SettingType.INTEGER);
    @setting minLevel = new Setting("pokemon.level.min", 1 as Integer, SettingType.INTEGER);
    @setting maxLevel = new Setting("pokemon.level.max", 100 as Integer, SettingType.INTEGER);

    @EventHandler(NewChannelEvent)
    async onNewChannel({ channel }: NewChannelEventArgs) {
        await PokemonEntity.createTable({ channel });
        await TrainerEntity.createTable({ channel });
    }
}