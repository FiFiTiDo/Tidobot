import AbstractModule, {Symbols} from "./AbstractModule";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import Command from "../Systems/Commands/Command";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {IntegerArg} from "../Systems/Commands/Validation/Integer";
import {StringArg, StringEnumArg} from "../Systems/Commands/Validation/String";
import {BooleanArg} from "../Systems/Commands/Validation/Boolean";
import axios from "axios";
import {getLogger} from "../Utilities/Logger";
import {Argument, ChannelArg, ResponseArg, RestArguments, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {PollService} from "../Services/PollService";
import {wait} from "../Utilities/functions";
import { Service } from "typedi";
import { Channel } from "../Database/Entities/Channel";
import { Chatter } from "../Database/Entities/Chatter";
import { EntityStateList } from "../Database/EntityStateLiist";
import Event from "../Systems/Event/Event";

export const MODULE_INFO = {
    name: "Poll",
    version: "1.2.0",
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

@Service()
class StrawpollCommand extends Command {
    private lastStrawpoll: EntityStateList<Channel, number>;

    constructor() {
        super("strawpoll", "<create|check>");

        this.lastStrawpoll = new EntityStateList<Channel, number>(-1);
    }

    @CommandHandler(/^(strawpoll|sp) check/, "strawpoll check [poll id]", 1)
    @CheckPermission(() => PollsModule.permissions.checkStrawpoll)
    async check(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
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
    @CheckPermission(() => PollsModule.permissions.createStrawpoll)
    async create(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(StringArg) title: string,
        @Argument(BooleanArg, "multi", false) multi = false,
        @Argument(new StringEnumArg(["normal", "permissive", "disabled"]), "dupcheck", false) dupcheck = "normal",
        @Argument(BooleanArg, "captcha", false) captcha = false,
        @RestArguments(true, {min: 2}) options: string[]
    ): Promise<void> {
        return axios.request<StrawpollPostResponse>({
            url: "https://www.strawpoll.me/api/v2/polls",
            method: "post",
            responseType: "json",
            data: {title, options, multi, dupcheck, captcha}
        }).then(resp => resp.data.id).then(id => {
            this.lastStrawpoll.set(channel, id);
            let times = channel.settings.get(PollsModule.settings.spamStrawpollLink);
            if (isNaN(times)) times = 1 as Integer;
            response.spam("poll:strawpoll.created", {url: `https://www.strawpoll.me/${id}`}, {times, seconds: 1});
        }).catch(e => response.genericErrorAndLog(e, logger));
    }
}

@Service()
class VoteCommand extends Command {
    constructor(private readonly pollService: PollService) {
        super("vote", "<option #>");
    }

    @CommandHandler("vote", "vote <option #>", 0, true)
    @CheckPermission(() => PollsModule.permissions.vote)
    async handleCommand(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel, @Sender sender: Chatter,
        @Argument(new IntegerArg({min: 0})) optionNum: number
    ): Promise<void> {
        const announce = channel.settings.get(PollsModule.settings.announceVotes);
        const option = this.pollService.getOption(optionNum, channel);
        const result = this.pollService.addVote(option, sender, channel);
        if (!result.present) return;
        if (announce) return result.value ?
            await response.message("poll:vote-accepted", {option}) :
            await response.message("poll:error.already-voted");
    }
}

@Service()
class PollCommand extends Command {
    constructor(private readonly pollService: PollService) {
        super("poll", "<run|stop|results>");
    }

    @CommandHandler("poll run", "poll run <option 1> <option 2> ... <option n>", 1)
    @CheckPermission(() => PollsModule.permissions.runPoll)
    async run(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @RestArguments(true, {min: 2}) options: string[]
    ): Promise<void> {
        const prefix = await CommandSystem.getPrefix(channel);
        const poll = this.pollService.createPoll(options, channel);
        if (!poll.present)
            return await response.message("poll:already-running", {prefix});
        await response.message("poll:open", {prefix});
        await response.message("poll:options", {
            options: options.map(((value, index) => "#" + (index + 1) + ": " + value)).join(", ")
        });
    }

    @CommandHandler("poll stop", "poll stop", 1)
    @CheckPermission(() => PollsModule.permissions.stopPoll)
    async stop(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel
    ): Promise<void> {
        const prefix = CommandSystem.getPrefix(channel);
        const results = this.pollService.closePoll(channel);
        if (!results.present)
            return await response.message("poll:error.not-running", {prefix});
        await response.message("poll:closed");
        await response.message("poll:lead-up");
        await wait(5000);
        await response.message("polls:results", {results});
    }

    @CommandHandler(/^poll res(ults)?/, "poll results", 1)
    @CheckPermission(() => PollsModule.permissions.viewResults)
    async results(
        event: Event, @ResponseArg response: Response, @ChannelArg channel: Channel
    ): Promise<void> {
        const prefix = CommandSystem.getPrefix(channel);
        const results = this.pollService.getResults(channel);
        if (!results.present)
            return await response.message("poll:error.no-recent", {prefix});
        await response.message("polls:results", {results});
    }
}

@Service()
export default class PollsModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        vote: new Permission("polls.vote", Role.NORMAL),
        runPoll: new Permission("polls.run", Role.MODERATOR),
        stopPoll: new Permission("polls.stop", Role.MODERATOR),
        viewResults: new Permission("polls.results", Role.MODERATOR),
        checkStrawpoll: new Permission("polls.strawpoll.check", Role.MODERATOR),
        createStrawpoll: new Permission("polls.strawpoll.create", Role.MODERATOR)
    }
    static settings = {
        announceVotes: new Setting("polls.announceVotes", true, SettingType.BOOLEAN),
        spamStrawpollLink: new Setting("polls.spamStrawpollLink", 1 as Integer, SettingType.INTEGER)
    }

    constructor(strawpollCommand: StrawpollCommand, voteCommand: VoteCommand, pollCommand: PollCommand) {
        super(PollsModule);

        this.registerCommands(strawpollCommand, voteCommand, pollCommand);
        this.registerPermissions(PollsModule.permissions);
        this.registerSettings(PollsModule.settings);
    }
}
