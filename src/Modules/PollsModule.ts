import AbstractModule, {ModuleInfo, Symbols, Systems} from "./AbstractModule";
import Message from "../Chat/Message";
import ChannelEntity, {ChannelStateList} from "../Database/Entities/ChannelEntity";
import ChatterEntity, {ChatterStateList} from "../Database/Entities/ChatterEntity";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {Integer, SettingType} from "../Systems/Settings/Setting";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {integer} from "../Systems/Commands/Validator/Integer";
import {string} from "../Systems/Commands/Validator/String";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import CliArgsValidationStrategy from "../Systems/Commands/Validator/Strategies/CliArgsValidationStrategy";
import {boolean} from "../Systems/Commands/Validator/Boolean";
import axios from "axios";
import {tuple} from "../Utilities/ArrayUtils";
import {getLogger} from "../Utilities/Logger";
import {command, Subcommand} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import {setting} from "../Systems/Settings/decorators";

export const MODULE_INFO = {
    name: "Poll",
    version: "1.0.0",
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

interface StrawpollCreateArgs {
    title: string;
    _: string[];
    multi: boolean;
    dupcheck: string;
    captcha: boolean;
}

class StrawpollCommand extends Command {
    private lastStrawpoll: ChannelStateList<number>;

    constructor(private readonly pollsModule: PollsModule) {
        super("strawpoll", "<create|check>");

        this.lastStrawpoll = new ChannelStateList<number>(-1);
    }

    @Subcommand("check")
    async check({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "strawpoll check [poll id]",
            arguments: tuple(
                integer({ name: "poll id", required: true })
            ),
            permission: this.pollsModule.checkStrawpoll
        }));
         if (status !== ValidatorStatus.OK) return;

        let pollId;
        if (args.length < 1) {
            if (!this.lastStrawpoll.hasChannel(msg.getChannel())) {
                await response.message("poll:strawpoll.error.no-recent");
                return;
            }

            pollId = this.lastStrawpoll.getChannel(msg.getChannel());
        } else {
            pollId = args[0];
        }

        const res = await axios.request<StrawpollGetResponse>({
            url: "https://www.strawpoll.me/api/v2/polls/" + pollId,
            responseType: "json"
        }).then(resp => resp.data);

        const total = res.votes.reduce((prev, next) => prev + next);
        const resp = res.options.map((option, index) => option + ": " + ((res.votes[index] / total) * 100) + "%").join(", ");
        await response.message("poll:results", {results: resp});
    }

    @Subcommand("create")
    async create({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new CliArgsValidationStrategy<StrawpollCreateArgs>({
            usage: "strawpoll create --title \"title\" <option 1> <option 2> ... [option n]",
            arguments: {
                title: string({ name: "title", required: true }),
                _: string({ name: "options", required: true, array: true }),
                multi: boolean({ name: "multi vote", required: false, defaultValue: false }),
                dupcheck: string({ name: "dup checking", required: false, defaultValue: "normal", accepted: ["normal", "permissive", "disabled"] }),
                captcha: boolean({ name: "captcha", required: false, defaultValue: false })
            },
            permission: this.pollsModule.createStrawpoll
        }));
         if (status !== ValidatorStatus.OK) return;
        const {title, _: options, multi, dupcheck, captcha} = args;

        if (options.length < 2) return response.message("poll:strawpoll.error.no-options");

        const resp = await axios.request<StrawpollPostResponse>({
            url: "https://www.strawpoll.me/api/v2/polls",
            method: "post",
            responseType: "json",
            data: {title, options, multi, dupcheck, captcha}
        }).then(resp => resp.data);

        let times = await msg.getChannel().getSetting(this.pollsModule.spamStrawpollLink);
        if (isNaN(times)) times = 1 as Integer;
        await response.spam("poll:strawpoll.created", {url: `https://www.strawpoll.me/${resp.id}`}, {
            times,
            seconds: 1
        });
    }
}

class Poll {
    private _open: boolean;
    private readonly votes: { [key: string]: ChatterEntity[] };
    private userVotes: ChatterStateList<string>;

    constructor(private readonly options: string[], private channel: ChannelEntity) {
        this.votes = {};
        this.userVotes = new ChatterStateList<string>("");

        for (const option of options)
            this.votes[option] = [];
    }

    validateVote(option: string, chatter: ChatterEntity): boolean {
        return this.options.indexOf(option) >= 0 && !this.userVotes.hasChatter(chatter);
    }

    addVote(option: string, chatter: ChatterEntity): boolean {
        if (!this.validateVote(option, chatter)) return false;
        this.votes[option].push(chatter);
        this.userVotes.setChatter(chatter, option);
        return true;
    }

    removeVote(chatter: ChatterEntity): boolean {
        const option = this.userVotes.getChatter(chatter);
        if (!option) return false;
        this.votes[option].splice(this.votes[option].indexOf(chatter), 1);
        return true;
    }

    open(): void {
        this._open = true;
    }

    close(): void {
        this._open = false;
    }

    getOption(index: number): string | null {
        index--;
        return index < 0 || index >= this.options.length ? null : this.options[index];
    }

    getTotalVotes(): number {
        return this.userVotes.size(this.channel);
    }

    getResults(): { [key: string]: ChatterEntity[] } {
        return this.votes;
    }

    formatResults(): string {
        const votes = this.getResults();
        const total = this.getTotalVotes();
        return Object.keys(votes).map(option => {
            const optionVotes = votes[option].length;
            const percentage = total < 1 ? 0 : (optionVotes / total) * 100;

            return `${option}: ${percentage}% (${optionVotes} votes)`;
        }).join(", ");
    }
}

class VoteCommand extends Command {
    constructor(private readonly pollsModule: PollsModule) {
        super("vote", "<option #>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const announce = await msg.getChannel().getSetting(this.pollsModule.announceVotes);
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "vote <option #>",
            arguments: tuple(
                integer({ name: "option number", required: true })
            ),
            permission: this.pollsModule.vote,
            silent: !announce
        }));
         if (status !== ValidatorStatus.OK) return;

        if (!this.pollsModule.runningPolls.hasChannel(msg.getChannel())) return;
        const poll = this.pollsModule.runningPolls.getChannel(msg.getChannel());
        const [optionNum] = args;

        const option = poll.getOption(optionNum);
        if (option === null) {
            if (announce)
                await CommandSystem.showInvalidArgument("option #", optionNum, "vote <option #>", msg);
            return;
        }

        const successful = poll.addVote(option, msg.getChatter());
        if (announce)
            return successful ? response.message("poll:vote-accepted", {option}) : response.message("poll:error.already-voted");
    }
}

class PollCommand extends Command {
    constructor(private readonly pollsModule: PollsModule) {
        super("poll", "<run|stop|results>");
    }

    @Subcommand("run")
    async run({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "!poll run <option 1> <option 2> ... <option n>",
            arguments: tuple(
                string({ name: "poll options", required: true, quoted: true, array: true })
            ),
            permission: this.pollsModule.runPoll
        }));
         if (status !== ValidatorStatus.OK) return;
        const [options] = args;
        const prefix = await CommandSystem.getPrefix(msg.getChannel());

        if (this.pollsModule.runningPolls.hasChannel(msg.getChannel())) {
            await response.message("poll:already-running", {prefix});
            return;
        }

        const poll = new Poll(options, msg.getChannel());
        this.pollsModule.runningPolls.setChannel(msg.getChannel(), poll);

        await response.message("poll:open", {prefix});
        await response.message("poll:options", {
            options: options.map(((value, index) => "#" + (index + 1) + ": " + value)).join(", ")
        });
    }

    @Subcommand("stop")
    async stop({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "poll stop",
            permission: this.pollsModule.stopPoll
        }));
         if (status !== ValidatorStatus.OK) return;

        const poll = await this.getPoll(msg);
        poll.close();
        await response.message("poll:closed");
        await response.message("poll:lead-up");

        setTimeout(() => {
            response.message("polls:results", {results: poll.formatResults()});
        }, 5000);
    }

    @Subcommand("results", "res")
    async results({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "poll results",
            permission: this.pollsModule.viewResults
        }));
         if (status !== ValidatorStatus.OK) return;

        if (!(await msg.checkPermission("polls.results"))) return;
        const poll = await this.getPoll(msg);
        await response.message("polls:results", {results: poll.formatResults()});
    }

    private async getPoll(msg: Message): Promise<Poll> {
        if (!this.pollsModule.runningPolls.hasChannel(msg.getChannel())) {
            await msg.getResponse().message("poll:error.not-running", {
                prefix: await CommandSystem.getPrefix(msg.getChannel())
            });
            return;
        }

        return this.pollsModule.runningPolls.getChannel(msg.getChannel());
    }
}

export default class PollsModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    readonly runningPolls: ChannelStateList<Poll>;

    constructor() {
        super(PollsModule);

        this.runningPolls = new ChannelStateList<Poll>(null);
    }

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
}
