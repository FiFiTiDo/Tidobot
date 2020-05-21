import AbstractModule from "./AbstractModule";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import TrainerEntity from "../Database/Entities/TrainerEntity";
import PokemonEntity, {formatStats} from "../Database/Entities/PokemonEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import {randomChance} from "../Utilities/RandomUtils";
import {array_rand, tuple} from "../Utilities/ArrayUtils";
import Logger from "../Utilities/Logger";
import {Response} from "../Chat/Response";
import ChannelManager from "../Chat/ChannelManager";
import {chatter as chatterConverter} from "../Systems/Commands/Validator/Chatter";
import {string} from "../Systems/Commands/Validator/String";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";

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
    Logger.get().debug("Decaying pokemon levels");
    for (const channel of channelManager.getAll())
        for await (const trainerData of await TrainerEntity.getAllTrainers(channel))
            await decay(trainerData.team);
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
function decayer(channelManager: ChannelManager): void {
    setTimeout(() => runDecay(channelManager).then(() => decayer(channelManager)), MS_PER_DAY / 2);
}

class PokemonCommand extends Command {
    constructor() {
        super("pokemon", "<team|throw|release|release-all|fight|stats|top>", ["poke", "pm"]);

        this.addSubcommand("team", this.team);
        this.addSubcommand("throw", this.throw);
        this.addSubcommand("release", this.release);
        this.addSubcommand("release-all", this.releaseAll);
        this.addSubcommand("fight", this.fight);
        this.addSubcommand("stats", this.stats);
        this.addSubcommand("top", this.top);
    }

    async getTrainerData(sender: ChatterEntity, response: Response): Promise<{ trainer: TrainerEntity, team: PokemonEntity[] }> {
        try {
            const trainer = await TrainerEntity.getByChatter(sender);
            const team = await trainer.team();
            return { trainer, team };
        } catch (e) {
            Logger.get().error("Unable to retrieve user's team", { cause: e });
            await response.genericError();
            return { trainer: null, team: [] };
        }
    }

    async team({ event, sender, response }: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
           usage: "pokemon team",
           permission: "pokemon.play"
        }));
         if (status !== ValidatorStatus.OK) return;

        const trainer = await TrainerEntity.getByChatter(sender);
        const teamArr = await trainer.team();
        const team = teamArr.map(pkmn => pkmn.toString());
        return response.message("pokemon:team", { username: sender.name, team });
    }

    async throw({ event, sender, channel, response }: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon throw [user]",
            arguments: tuple(
                chatterConverter({ name: "user", required: true })
            ),
            permission: "pokemon.play"
        }));
         if (status !== ValidatorStatus.OK) return;

        const { trainer, team } = await this.getTrainerData(sender, response);
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
        if (!randomChance(baseChance - (stats.level/1000.0)))
            return response.message("pokemon:catch.full", {
                username: sender.name,
                pokemon: formatStats(stats),
                result: array_rand(await response.getTranslation("pokemon:catch.failed"))
            });

        let pokemon;
        try {
            pokemon = await PokemonEntity.fromStats(trainer, stats);
        } catch (e) {
            Logger.get().error("Failed to generate pokemon entity from stats", { cause: e });
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

    async release({ event, response, sender}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon release [pokemon]",
            arguments: tuple(
                string({ name: "pokemon name", required: false, defaultValue: undefined })
            ),
            permission: "pokemon.play"
        }));
         if (status !== ValidatorStatus.OK) return;

        const { trainer, team } = await this.getTrainerData(sender, response);
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
            Logger.get().error("Unable to delete pokemon from database", { cause: e });
            return response.genericError();
        }
    }

    async releaseAll({ event, sender, response }: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon release-all",
            permission: "pokemon.play"
        }));
         if (status !== ValidatorStatus.OK) return;

        const { trainer, team } = await this.getTrainerData(sender, response);
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
            Logger.get().error("Unable to delete all pokemon from a team", { cause: e });
            await response.genericError();
        }
    }

    async fight({ event, sender, response, channel}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon fight <trainer>",
            arguments: tuple(
                chatterConverter({ name: "trainer", required: true, active: true })
            ),
            permission: "pokemon.play"
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
        const MIN_WIN = 50 + draw_chance/2;
        const MAX_LOSS = 50 - draw_chance/2;

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
            Logger.get().error("Unable to save trainer data", { cause: e });
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
                result += " " + await response.translate("pokemon:battle.level-up", { pokemon: levelUp.join(", ") });
        } catch (e) {
            Logger.get().error("Unable to save pokemon data", { cause: e });
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

    async stats({ event, sender, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon stats",
            permission: "pokemon.stats"
        }));
         if (status !== ValidatorStatus.OK) return;

        let { trainer } = await this.getTrainerData(sender, response);
        if (trainer === null) return;

        const { won, lost, draw } = trainer;
        let ratio = ((won / (won + lost + draw)) * 100);
        if (isNaN(ratio)) ratio = 0;

        return response.message("pokemon:stats", { username: sender.name, ratio, won, lost, draw })
    }

    async top({ event, channel, response }: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "pokemon release-all",
            permission: "pokemon.stats"
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
            Logger.get().error("Unable to get all trainer data", { cause: e });
            return response.genericError();
        }

        const sorted = names.sort((a, b) => levels[b] - levels[a]);
        const top10 = sorted.slice(0, 10);
        const topStr = top10.map(name => `${name}(${levels[name]})`).join(", ");

        return response.message("pokemon:top", { trainers: topStr });
    }
}

export default class PokemonModule extends AbstractModule {
    constructor(channelManager: ChannelManager) {
        super(PokemonModule.name);

        decayer(channelManager);
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new PokemonCommand(), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("pokemon.play", Role.NORMAL));
        perm.registerPermission(new Permission("pokemon.stats", Role.NORMAL));
        perm.registerPermission(new Permission("pokemon.stats.other", Role.MODERATOR));

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("pokemon.max-team-size", "5", SettingType.INTEGER));
        settings.registerSetting(new Setting("pokemon.chance.base-catch", "0.3", SettingType.FLOAT));
        settings.registerSetting(new Setting("pokemon.chance.shiny", "0.05", SettingType.FLOAT));
        settings.registerSetting(new Setting("pokemon.chance.rus", "0.01", SettingType.FLOAT));
        settings.registerSetting(new Setting("pokemon.chance.draw", "4", SettingType.INTEGER));
        settings.registerSetting(new Setting("pokemon.level.min", "1", SettingType.INTEGER));
        settings.registerSetting(new Setting("pokemon.level.max", "100", SettingType.INTEGER));
    }
}