import AbstractModule, {Symbols} from "./AbstractModule";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {Float, Integer, SettingType} from "../Systems/Settings/Setting";
import TrainerEntity from "../Database/Entities/TrainerEntity";
import PokemonEntity, {formatStats} from "../Database/Entities/PokemonEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import {randomChance} from "../Utilities/RandomUtils";
import {array_rand} from "../Utilities/ArrayUtils";
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
import {InvalidInputError} from "../Systems/Commands/Validation/ValidationErrors";
import ChannelEntity from "../Database/Entities/ChannelEntity";

export const MODULE_INFO = {
    name: "Pokemon",
    version: "1.1.0",
    description: "Play pokemon using other users as your team's pokemon"
};

const logger = getLogger(MODULE_INFO.name);

export const NATURES = [
    'evil', 'mean', 'crazy', 'happy', 'cute',
    'pretty', 'beautiful', 'amazing', 'sleepy',
    'weird', 'funny', 'boring', 'lame', 'silly',
    'neat', 'fun', 'enjoyable', 'pleasing', 'tall',
    'appealing', 'dumb', 'awesome', 'stupid',
    'friendly', 'freaky', 'elegant', 'rich', 'odd',
    'lucky', 'young', 'old', 'unknown', 'confused',
    'forgetful', 'talkative', 'mature', 'immature',
    'strong', 'weak', 'malnourished', 'hungry',
    'dying', 'super', 'naughty', 'short', 'toothless'
];

async function decay(team: PokemonEntity[]): Promise<void> {
    for (const pkmn of team) {
        if (pkmn.level > 1) {
            pkmn.level--;
            await pkmn.save();
        } else {
            await pkmn.delete();
        }
    }
}

async function runDecay(channelManager: ChannelManager): Promise<void> {
    logger.debug("Decaying pokemon levels");
    for (const channel of channelManager.getAll())
        for await (const trainerData of await TrainerEntity.getAllTrainers(channel))
            await decay(trainerData.team);
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function decayer(channelManager: ChannelManager): void {
    setTimeout(() => runDecay(channelManager).then(() => decayer(channelManager)), MS_PER_DAY / 2);
}

interface TrainerData {
    chatter: ChatterEntity;
    trainer: TrainerEntity;
    team: PokemonEntity[];
}

const TrainerSender = makeEventReducer(async event => {
    const chatter = event.getMessage().getChatter();
    const trainer = await TrainerEntity.getByChatter(event.getMessage().getChatter());
    const team = await trainer?.team() ?? [];
    return {chatter, trainer, team}
});
class TrainerDataArg {
    private static chatterArg = new ChatterArg();

    static type = "trainer";
    static async convert(input: string, name: string, column: number, event: CommandEvent): Promise<TrainerData> {
        const response = event.getMessage().getResponse();
        const chatter = await this.chatterArg.convert(input, name, column, event);
        const trainer = await TrainerEntity.getByChatter(chatter);
        if (trainer === null)
            throw new InvalidInputError(await response.translate("pokemon:error.no-trainer", {username: input}));
        const team = await trainer.team();
        return {trainer, team, chatter};
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
        event: CommandEvent, @ResponseArg response, @Channel channel: ChannelEntity, @TrainerSender {trainer, team}: TrainerData,
        @Argument(new ChatterArg(), "target", false) chatter: ChatterEntity = null, @Sender sender: ChatterEntity
    ): Promise<void> {
        const maxTeamSize = await channel.getSetting(this.pokemonModule.maxTeamSize);
        if (team.length >= maxTeamSize) return response.message("pokemon:error.full");

        const stats = await PokemonEntity.generateStats(trainer);
        if (chatter !== null) {
            stats.name = chatter.name;

            if (team.some(pkmn => pkmn.name === chatter.name))
                return response.message("pokemon:error.already-caught");
        }

        const baseChance = await channel.getSetting(this.pokemonModule.baseCatchChance);
        if (!randomChance(baseChance - (stats.level / 1000.0))) return response.message("pokemon:catch.full", {
            username: sender.name,
            pokemon: formatStats(stats),
            result: array_rand(await response.getTranslation("pokemon:catch.failed"))
        });

        return PokemonEntity.fromStats(trainer, stats).then(async pkmn => response.message("pokemon:catch.full", {
            username: sender.name,
            pokemon: pkmn.toFullString(),
            result: await response.translate("pokemon:catch.success", {
                nature: pkmn.nature
            })
        })).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(pokemon|poke|pm) rel(ease)?/, "pokemon release [pokemon]", 1)
    @CheckPermission("pokemon.play")
    async release(
        event: CommandEvent, @ResponseArg response: Response, @Sender sender: ChatterEntity,
        @TrainerSender {trainer, team}: TrainerData, @Argument(StringArg, "pokemon", false) name: string = null
    ): Promise<void> {
        let pokemon = null;
        if (name !== null) {
            pokemon = team.find(pkmn => pkmn.name.toLowerCase() === name.toLowerCase());
            if (pokemon === undefined) return response.message("pokemon:error.not-caught");
        } else {
            if (team.length < 1) return response.message("pokemon:error.empty");
            pokemon = array_rand(team);
        }

        return pokemon.delete().then(() => response.message("pokemon:released", {
            username: sender.name,
            pokemon: pokemon.toFullString()
        })).catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(pokemon|poke|pm) rel(ease)?-all/, "pokemon release-all", 1)
    @CheckPermission("pokemon.play")
    async releaseAll(
        event: CommandEvent, @ResponseArg response: Response, @Sender sender: ChatterEntity,
        @TrainerSender {team}: TrainerData
    ): Promise<void> {
        const pokemon = team.map(pkmn => pkmn.name).join(", ");
        return Promise.all(team.map(pkmn => pkmn.delete()))
            .then(() => response.message("pokemon.released", {username: sender.name, pokemon}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }

    @CommandHandler(/^(pokemon|poke|pm) fight/, "pokemon fight <trainer>", 1)
    @CheckPermission("pokemon.play")
    async fight(
        event: CommandEvent, @ResponseArg response: Response, @Sender sender: ChatterEntity, @Channel channel: ChannelEntity,
        @TrainerSender self: TrainerData, @Argument(TrainerDataArg,"trainer") target: TrainerData
    ): Promise<void> {

        if (sender.is(target.chatter)) return response.message("pokemon:error.self");

        if (self.team.length < 1) return response.message("pokemon:error.no-team-self");
        if (target.team.length < 1) return response.message("pokemon:error.no-team-target");

        const selfMon = array_rand(self.team);
        const targetMon = array_rand(target.team);

        const win = (Math.random() * 100) - ((targetMon.level - selfMon.level) / 2.1);

        let selfExp = 0;
        let targetExp = 0;
        let result: string;

        const draw_chance = await channel.getSetting(this.pokemonModule.drawChance);
        const MIN_WIN = 50 + draw_chance / 2;
        const MAX_LOSS = 50 - draw_chance / 2;

        if (win > MIN_WIN) { // Win
            self.trainer.won++;
            target.trainer.lost++;
            selfExp = targetMon.level;
            result = await response.translate("pokemon:battle.win");
        } else if (win < MAX_LOSS) { // Loss
            self.trainer.lost++;
            target.trainer.won++;
            targetExp = selfMon.level;
            result = await response.translate("pokemon:battle.lose");
        } else { // Draw
            self.trainer.draw++;
            target.trainer.draw++;
            selfExp = targetMon.level / 2;
            targetExp = selfMon.level / 2;
            result = await response.translate("pokemon:battle.draw");
        }

        try {
            await self.trainer.save();
            await target.trainer.save();
        } catch (e) {
            return await response.genericErrorAndLog(e, logger);
        }

        try {
            const levelUp = [];
            if (selfMon.addExperience(selfExp)) {
                levelUp.push(selfMon.name);
                await selfMon.save();
            }
            if (targetMon.addExperience(targetExp)) {
                levelUp.push(targetMon.name);
                await targetMon.save();
            }
            if (levelUp.length > 0)
                result += " " + await response.translate("pokemon:battle.level-up", {pokemon: levelUp.join(", ")});
        } catch (e) {
            return await response.genericErrorAndLog(e, logger);
        }

        await response.message("pokemon:battle.base", {
            self: sender.name,
            selfMon: selfMon.toString(),
            target: target.chatter.name,
            targetMon: targetMon.toString(),
            result
        })
    }

    @CommandHandler(/^(pokemon|poke|pm) stats/, "pokemon stats [trainer]", 1)
    @CheckPermission(event => event.getArgumentCount() < 1 ? "pokemon.stats" : "pokemon.stats.other")
    async stats(
        event: CommandEvent, @ResponseArg response: Response, @TrainerSender sender: TrainerData,
        @Argument(TrainerDataArg, "trainer", false) target: TrainerData = null
    ): Promise<void> {
        const {chatter, trainer: {won, lost, draw}} = target ?? sender;
        let ratio = ((won / (won + lost + draw)) * 100);
        if (isNaN(ratio)) ratio = 0;
        return response.message("pokemon:stats", {username: chatter.name, ratio, won, lost, draw})
    }

    @CommandHandler(/^(pokemon|poke|pm) top/, "pokemon top", 1)
    @CheckPermission("pokemon.stats")
    async top(event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity): Promise<void> {
        const names = [];
        const data = {};
        const levels = {};

        try {
            for await (const trainerData of await TrainerEntity.getAllTrainers(channel)) {
                const chatter = await trainerData.trainer.chatter();
                names.push(chatter.name);
                data[chatter.name] = trainerData;
                levels[chatter.name] = trainerData.team.reduce((prev, pkmn) => prev + pkmn.level, 0);
            }
        } catch (e) {
            return await response.genericErrorAndLog(e, logger);
        }

        const sorted = names.sort((a, b) => levels[b] - levels[a]);
        const top10 = sorted.slice(0, 10);
        const topStr = top10.map(name => `${name}(${levels[name]})`).join(", ");

        return response.message("pokemon:top", {trainers: topStr});
    }
}

@HandlesEvents()
export default class PokemonModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor(channelManager: ChannelManager) {
        super(PokemonModule);

        decayer(channelManager);
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