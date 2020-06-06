import AbstractModule, {ModuleInfo, Symbols, Systems} from "./AbstractModule";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {Float, Integer, SettingType} from "../Systems/Settings/Setting";
import TrainerEntity from "../Database/Entities/TrainerEntity";
import PokemonEntity, {formatStats} from "../Database/Entities/PokemonEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import {randomChance} from "../Utilities/RandomUtils";
import {array_rand, tuple} from "../Utilities/ArrayUtils";
import {Response} from "../Chat/Response";
import ChannelManager from "../Chat/ChannelManager";
import {chatter, chatter as chatterConverter} from "../Systems/Commands/Validator/Chatter";
import {string} from "../Systems/Commands/Validator/String";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import {getLogger} from "../Utilities/Logger";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {command, Subcommand} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {setting} from "../Systems/Settings/decorators";

export const MODULE_INFO = {
    name: "Pokemon",
    version: "1.0.0",
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

class PokemonCommand extends Command {
    constructor(private pokemonModule: PokemonModule) {
        super("pokemon", "<team|throw|release|release-all|fight|stats|top>", ["poke", "pm"]);
    }

    async getTrainerData(sender: ChatterEntity, response: Response): Promise<{ trainer: TrainerEntity, team: PokemonEntity[] }> {
        try {
            const trainer = await TrainerEntity.getByChatter(sender);
            const team = await trainer.team();
            return {trainer, team};
        } catch (e) {
            logger.error("Unable to retrieve user's team");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            await response.genericError();
            return {trainer: null, team: []};
        }
    }

    @Subcommand("team")
    async team({event, sender, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon team",
            permission: this.pokemonModule.playPokemon
        }));
        if (status !== ValidatorStatus.OK) return;

        const trainer = await TrainerEntity.getByChatter(sender);
        const teamArr = await trainer.team();
        const team = teamArr.map(pkmn => pkmn.toString());
        return response.message("pokemon:team", {username: sender.name, team});
    }

    @Subcommand("throw")
    async throw({event, sender, channel, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon throw [user]",
            arguments: tuple(
                chatterConverter({name: "user", required: true})
            ),
            permission: this.pokemonModule.playPokemon
        }));
        if (status !== ValidatorStatus.OK) return;

        const {trainer, team} = await this.getTrainerData(sender, response);
        if (trainer === null) return;

        const maxTeamSize = await channel.getSetting<number>("pokemon.max-team-size");
        if (team.length >= maxTeamSize) return response.message("pokemon:error.full");

        const stats = await PokemonEntity.generateStats(trainer);
        if (args[0]) {
            const chatter = args[0] as ChatterEntity;
            stats.name = chatter.name;

            for (const pkmn of team)
                if (pkmn.name === chatter.name)
                    return response.message("pokemon:error.already-caught");
        }

        const baseChance = await channel.getSetting<number>("pokemon.chance.base-catch");
        if (!randomChance(baseChance - (stats.level / 1000.0)))
            return response.message("pokemon:catch.full", {
                username: sender.name,
                pokemon: formatStats(stats),
                result: array_rand(await response.getTranslation("pokemon:catch.failed"))
            });

        let pokemon;
        try {
            pokemon = await PokemonEntity.fromStats(trainer, stats);
        } catch (e) {
            logger.error("Failed to generate pokemon entity from stats");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            return response.genericError();
        }

        return response.message("pokemon:catch.full", {
            username: sender.name,
            pokemon: pokemon.toFullString(),
            result: await response.translate("pokemon:catch.success", {
                nature: pokemon.nature
            })
        });
    }

    @Subcommand("release", "rel")
    async release({event, response, sender}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon release [pokemon]",
            arguments: tuple(
                string({name: "pokemon name", required: false, defaultValue: undefined})
            ),
            permission: this.pokemonModule.playPokemon
        }));
        if (status !== ValidatorStatus.OK) return;

        const {trainer, team} = await this.getTrainerData(sender, response);
        if (trainer === null) return;

        let pokemon = null;
        if (args[0]) {
            for (const pkmn of team)
                if (pkmn.name.toLowerCase() === (args[0] as string).toLowerCase()) {
                    pokemon = pkmn;
                    break;
                }
            if (pokemon === null)
                return response.message("pokemon:error.not-caught");
        } else {
            if (team.length < 1)
                return response.message("pokemon:error.empty");
            pokemon = array_rand(team);
        }

        try {
            await pokemon.delete();
            await response.message("pokemon:released", {
                username: sender.name,
                pokemon: pokemon.toFullString()
            })
        } catch (e) {
            logger.error("Unable to delete pokemon from database");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            return response.genericError();
        }
    }

    @Subcommand("release-all", "rel-all")
    async releaseAll({event, sender, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon release-all",
            permission: this.pokemonModule.playPokemon
        }));
        if (status !== ValidatorStatus.OK) return;

        const {trainer, team} = await this.getTrainerData(sender, response);
        if (trainer === null) return;

        try {
            const names = [];
            const ops = [];
            for (const pkmn of team) {
                names.push(pkmn.name);
                ops.push(pkmn.delete());
            }
            await Promise.all(ops);
            await response.message("pokemon.released", {
                username: sender.name,
                pokemon: names.join(", ")
            });
        } catch (e) {
            logger.error("Unable to delete all pokemon from a team");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            await response.genericError();
        }
    }

    @Subcommand("fight")
    async fight({event, sender, response, channel}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon fight <trainer>",
            arguments: tuple(
                chatterConverter({name: "trainer", required: true, active: true})
            ),
            permission: this.pokemonModule.playPokemon
        }));
        if (status !== ValidatorStatus.OK) return;
        const [chatter] = args;

        if (sender.is(chatter)) return response.message("pokemon:error.self");

        const self = await this.getTrainerData(sender, response);
        const target = await this.getTrainerData(chatter, response);

        if (self.team.length < 1) return response.message("pokemon:error.no-team-self");
        if (target.team.length < 1) return response.message("pokemon:error.no-team-target");

        const selfMon = array_rand(self.team);
        const targetMon = array_rand(target.team);

        const win = (Math.random() * 100) - ((targetMon.level - selfMon.level) / 2.1);

        let selfExp = 0;
        let targetExp = 0;
        let result: string;

        const draw_chance = await channel.getSetting<number>("pokemon.chance.draw");
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
            logger.error("Unable to save trainer data");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            return response.genericError();
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
            logger.error("Unable to save pokemon data");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            return response.genericError();
        }

        await response.message("pokemon:battle.base", {
            self: sender.name,
            selfMon: selfMon.toString(),
            target: chatter.name,
            targetMon: targetMon.toString(),
            result
        })
    }

    @Subcommand("stats")
    async stats({event, sender, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon stats",
            arguments: tuple(
                chatter({ name: "trainer", required: false })
            ),
            permission: args => args[0] === null ? this.pokemonModule.viewStats : this.pokemonModule.viewOthersStats
        }));
        if (status !== ValidatorStatus.OK) return;

        const user = args[0] === null ? sender : args[0];
        let {trainer} = await this.getTrainerData(user, response);
        if (trainer === null) return;

        const {won, lost, draw} = trainer;
        let ratio = ((won / (won + lost + draw)) * 100);
        if (isNaN(ratio)) ratio = 0;

        return response.message("pokemon:stats", {username: user.name, ratio, won, lost, draw})
    }

    @Subcommand("top")
    async top({event, channel, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon release-all",
            permission: this.pokemonModule.viewStats
        }));
        if (status !== ValidatorStatus.OK) return;

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
            logger.error("Unable to get all trainer data");
            logger.error("Caused by: " + e.message);
            logger.error(e.stack);
            return response.genericError();
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