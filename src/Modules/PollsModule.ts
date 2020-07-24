import AbstractModule, {Symbols} from "./AbstractModule";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {IntegerArg} from "../Systems/Commands/Validation/Integer";
import {StringArg, StringEnumArg} from "../Systems/Commands/Validation/String";
import {BooleanArg} from "../Systems/Commands/Validation/Boolean";
import axios from "axios";
import {getLogger} from "../Utilities/Logger";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {setting} from "../Systems/Settings/decorators";
import EntityStateList from "../Database/EntityStateList";
import {Argument, Channel, ResponseArg, RestArguments, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {PollService} from "../Services/PollService";
import {wait} from "../Utilities/functions";

export const MODULE_INFO = {
    name: "Poll",
    version: "1.1.1",
    description: "Run polls to get user input on a question"
};

const logger = getLogger(MODULE_INFO.name);

interface StrawpollGetResponse {
    id: number;
    title: string;
    multi: boolean;
    options: string[];
    votes: number[];
}

interface StrawpollPostResponse {
    id: number;
    title: string;
    options: string[];
    multi: boolean;
    dupcheck: string;
    captcha: boolean;
}

class StrawpollCommand extends Command {
    private lastStrawpoll: EntityStateList<ChannelEntity, number>;

    constructor(private readonly pollsModule: PollsModule) {
        super("strawpoll", "<create|check>");

        this.lastStrawpoll = new EntityStateList<ChannelEntity, number>(-1);
    }

    @CommandHandler(/^(strawpoll|sp) check/, "strawpoll check [poll id]", 1)
    @CheckPermission("polls.strawpoll.check")
    async check(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(new IntegerArg({min: 0}), "poll id") pollId: number = null
    ): Promise<void> {
        if (pollId === null) {
            if (!this.lastStrawpoll.has(channel))
                return await response.message("poll:strawpoll.error.no-recent");
            pollId = this.lastStrawpoll.get(channel);
        }

        return await axios.request<StrawpollGetResponse>({
            url: "https://www.strawpoll.me/api/v2/polls/" + pollId,
            responseType: "json"
        }).then(resp => resp.data).then(data => {
            const total = data.votes.reduce((prev, next) => prev + next);
            const percentages = data.votes.map(count => (count / total) * 100);
            const resp = data.options.map((option, i) => option + ": " + percentages[i] + "%").join(", ");
            return response.message("poll:results", {results: resp});
        });
    }

    @CommandHandler("strawpoll create", "strawpoll create --title \"title\" <option 1> <option 2> ... [option n]", 1, false, true)
    @CheckPermission("polls.strawpoll.create")
    async create(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @Argument(StringArg) title: String,
        @Argument(BooleanArg, "multi", false) multi: boolean = false,
        @Argument(new StringEnumArg(["normal", "permissive", "disabled"]), "dupcheck", false) dupcheck: string = "normal",
        @Argument(BooleanArg, "captcha", false) captcha: boolean = false,
        @RestArguments(true, {min: 2}) options: string[]
    ): Promise<void> {
        return axios.request<StrawpollPostResponse>({
            url: "https://www.strawpoll.me/api/v2/polls",
            method: "post",
            responseType: "json",
            data: {title, options, multi, dupcheck, captcha}
        }).then(resp => resp.data.id).then(id => {
            this.lastStrawpoll.set(channel, id);
            return channel.getSetting(this.pollsModule.spamStrawpollLink).then(times => {
                return isNaN(times) ? 1 as Integer : times;
            }).then(times => response.spam(
                "poll:strawpoll.created", {url: `https://www.strawpoll.me/${id}`}, {times, seconds: 1}
            ));
        }).catch(e => response.genericErrorAndLog(e, logger));
    }
}

class VoteCommand extends Command {
    constructor(private readonly pollsModule: PollsModule) {
        super("vote", "<option #>");
    }

    @CommandHandler("vote", "vote <option #>", 0, true)
    @CheckPermission("polls.vote")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity, @Sender sender: ChatterEntity,
        @Argument(new IntegerArg({min: 0})) optionNum: number
    ): Promise<void> {
        const announce = await channel.getSetting(this.pollsModule.announceVotes);
        const option = this.pollsModule.pollService.getOption(optionNum, channel);
        const result = this.pollsModule.pollService.addVote(option, sender, channel);
        if (!result.present) return;
        if (announce) return result.value ?
            await response.message("poll:vote-accepted", {option}) :
            await response.message("poll:error.already-voted");
    }
}

class PollCommand extends Command {
    constructor(private readonly pollsModule: PollsModule) {
        super("poll", "<run|stop|results>");
    }

    @CommandHandler("poll run", "poll run <option 1> <option 2> ... <option n>", 1)
    @CheckPermission("polls.run")
    async run(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity,
        @RestArguments(true, {min: 2}) options: string[]
    ): Promise<void> {
        const prefix = await CommandSystem.getPrefix(channel);
        const poll = this.pollsModule.pollService.createPoll(options, channel);
        if (!poll.present)
            return await response.message("poll:already-running", {prefix});
        await response.message("poll:open", {prefix});
        await response.message("poll:options", {
            options: options.map(((value, index) => "#" + (index + 1) + ": " + value)).join(", ")
        });
    }

    @CommandHandler("poll stop", "poll stop", 1)
    @CheckPermission("polls.stop")
    async stop(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity
    ): Promise<void> {
        const prefix = await CommandSystem.getPrefix(channel);
        const results = this.pollsModule.pollService.closePoll(channel);
        if (!results.present)
            return await response.message("poll:error.not-running", {prefix});
        await response.message("poll:closed");
        await response.message("poll:lead-up");
        await wait(5000);
        await response.message("polls:results", {results});
    }

    @CommandHandler(/^poll res(ults)?/, "poll results", 1)
    @CheckPermission("polls.results")
    async results(
        event: CommandEvent, @ResponseArg response: Response, @Channel channel: ChannelEntity
    ): Promise<void> {
        const prefix = await CommandSystem.getPrefix(channel);
        const results = this.pollsModule.pollService.getResults(channel);
        if (!results.present)
            return await response.message("poll:error.no-recent", {prefix});
        await response.message("polls:results", {results});
    }
}

export default class PollsModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    readonly pollService: PollService;
    @command pollCommand = new PollCommand(this);
    @command voteCommand = new VoteCommand(this);
    @command strawpollCommand = new StrawpollCommand(this);
    @permission vote = new Permission("polls.vote", Role.NORMAL);
    @permission runPoll = new Permission("polls.run", Role.MODERATOR);
    @permission stopPoll = new Permission("polls.stop", Role.MODERATOR);
    @permission viewResults = new Permission("polls.results", Role.MODERATOR);
    @permission checkStrawpoll = new Permission("polls.strawpoll.check", Role.MODERATOR);
    @permission createStrawpoll = new Permission("polls.strawpoll.create", Role.MODERATOR);
    @setting announceVotes = new Setting("polls.announceVotes", true, SettingType.BOOLEAN);
    @setting spamStrawpollLink = new Setting("polls.spamStrawpollLink", 1 as Integer, SettingType.INTEGER);

    constructor() {
        super(PollsModule);

        this.pollService = new PollService();
    }
}
