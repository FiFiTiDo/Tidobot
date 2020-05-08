import AbstractModule from "./AbstractModule";
import Message from "../Chat/Message";
import ChannelEntity, {ChannelStateList} from "../Database/Entities/ChannelEntity";
import ChatterEntity, {ChatterStateList} from "../Database/Entities/ChatterEntity";
import {Key} from "../Utilities/Translator";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import Permission from "../Systems/Permissions/Permission";
import {Role} from "../Systems/Permissions/Role";
import Setting, {SettingType} from "../Systems/Settings/Setting";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import request = require("request-promise-native");
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";

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
    private lastStrawpoll: ChannelStateList<number>;

    constructor() {
        super("strawpoll", "<create|check>");

        this.addSubcommand("create", this.create);
        this.addSubcommand("check", this.check);

        this.lastStrawpoll = new ChannelStateList<number>(-1);
    }

    async check({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "strawpoll check [poll id]",
            arguments: [
                {
                    value: {
                        type: "integer",
                    },
                    required: false
                }
            ]
        });
        if (args === null) return;

        let pollId;
        if (args.length < 1) {
            if (!this.lastStrawpoll.hasChannel(msg.getChannel())) {
                await response.message(Key("polls.strawpoll.not_found"));
                return;
            }

            pollId = this.lastStrawpoll.getChannel(msg.getChannel());
        } else {
            pollId = args[0];
        }

        const res: StrawpollGetResponse = await request({
            uri: "https://www.strawpoll.me/api/v2/polls/" + pollId,
            json: true
        }).promise();

        const total = res.votes.reduce((prev, next) => prev + next);
        const resp = res.options.map((option, index) => option + ": " + ((res.votes[index] / total) * 100) + "%").join(", ");
        await response.message(Key("polls.results"), resp);
    }

    async create({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "strawpoll create --title \"title\" <option 1> <option 2> ... [option n]",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    key: "title"
                },
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    key: "_"
                },
                {
                    value: {
                        type: "boolean",
                    },
                    required: false,
                    defaultValue: "false",
                    key: "multi"
                },
                {
                    value: {
                        type: "string",
                        accepted: ["normal", "permissive", "disabled"],
                    },
                    required: false,
                    defaultValue: "normal",
                    key: "dupcheck"
                },
                {
                    value: {
                        type: "boolean",
                    },
                    required: false,
                    defaultValue: "false",
                    key: "captcha"
                }
            ],
            cliArgs: true,
            permission: "polls.strawpoll.create"
        });
        if (args === null) return;
        const {title, _: options, multi, dupcheck, captcha} = args;

        if (options.length < 2) return response.message(Key("polls.strawpoll.no_options"));

        const resp: StrawpollPostResponse = await request({
            uri: "https://www.strawpoll.me/api/v2/polls",
            method: "post",
            json: true,
            body: {title, options, multi, dupcheck, captcha}
        }).promise();

        let times = await msg.getChannel().getSetting<number>("polls.spamStrawpollLink");
        if (isNaN(times)) times = 1;
        await response.spam(Key("polls.strawpoll.created"), times, 1, `https://www.strawpoll.me/${resp.id}`);
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
        return this.options.indexOf(option) >= 0 && this.userVotes.hasChatter(chatter);
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

    getOption(index: number): string|null {
        return index < 0 || index >= this.options.length ? null : this.options[index];
    }

    getTotalVotes(): number {
        return this.userVotes.size(this.channel);
    }

    getResults(): { [key: string]: ChatterEntity[] } {
        return this.votes;
    }
}

class VoteCommand extends Command {
    constructor(private runningPolls: ChannelStateList<Poll>) {
        super("vote", "<option #>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const announce = await msg.getChannel().getSettings().get("polls.announceVotes");
        const args = await event.validate({
            usage: "vote <option #>",
            arguments: [
                {
                    value: {
                        type: "integer",
                    },
                    required: true,
                    silentFail: !announce
                }
            ],
            permission: "polls.vote"
        });
        if (args === null) return;

        if (!this.runningPolls.hasChannel(msg.getChannel())) return;
        const poll = this.runningPolls.getChannel(msg.getChannel());
        const optionNum = args[0] as number;

        const option = poll.getOption(optionNum);
        if (option === null) {
            if (announce)
                await CommandSystem.showInvalidArgument("option #", event.getArgument(1), "vote <option #>", msg);
            return;
        }

        const successful = poll.addVote(option, msg.getChatter());
        if (announce)
            return successful ? response.message(Key("polls.vote_accepted")) : response.message(Key("polls.already_voted"));
    }
}

class PollCommand extends Command {
    constructor(private runningPolls: ChannelStateList<Poll>) {
        super("poll", "<run|stop|results>");

        this.addSubcommand("run", this.run);
        this.addSubcommand("stop", this.stop);
        this.addSubcommand("results", this.results);
        this.addSubcommand("res", this.results);
    }

    private async getPoll(msg: Message): Promise<Poll> {
        if (!this.runningPolls.hasChannel(msg.getChannel())) {
            await msg.getResponse().message(Key("polls.not_running"), await CommandSystem.getPrefix(msg.getChannel()));
            return;
        }

        return this.runningPolls.getChannel(msg.getChannel());
    }

    async run({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "!poll run <option 1> <option 2> ... <option n>",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    array: true
                }
            ],
            permission: "polls.run"
        });
        if (args === null) return;
        const options = args[0] as string[];
        const prefix = await CommandSystem.getPrefix(msg.getChannel());

        if (this.runningPolls.hasChannel(msg.getChannel())) {
            await response.message(Key("polls.already_running"), prefix);
            return;
        }

        const poll = new Poll(options, msg.getChannel());
        this.runningPolls.setChannel(msg.getChannel(), poll);

        await response.message(Key("polls.open"), prefix);
        await response.message(Key("polls.options"), options.map(((value, index) => "#" + (index + 1) + ": " + value)));
    }

    async stop({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "poll stop",
            permission: "polls.stop"
        });
        if (args === null) return;

        const poll = await this.getPoll(msg);
        poll.close();
        await response.message(Key("polls.closed"));
        await response.message(Key("polls.drumroll_please"));

        setTimeout(() => {
            const votes = poll.getResults();
            const resp = Object.keys(votes).map(option => option + ": " + ((votes[option].length / poll.getTotalVotes()) * 100) + "%").join(", ");
            response.message(Key("polls.results"), resp);
        }, 5000);
    }

    async results({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "poll results",
            permission: "polls.results"
        });
        if (args === null) return;

        if (!(await msg.checkPermission("polls.results"))) return;
        const poll = await this.getPoll(msg);
        const votes = poll.getResults();
        const resp = Object.keys(votes).map(option => option + ": " + ((votes[option].length / poll.getTotalVotes()) * 100) + "%").join(", ");
        await response.message(Key("polls.results"), resp);
    }
}

export default class PollsModule extends AbstractModule {
    private readonly runningPolls: ChannelStateList<Poll>;

    constructor() {
        super(PollsModule.name);

        this.runningPolls = new ChannelStateList<Poll>(null);
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new PollCommand(this.runningPolls), this);
        cmd.registerCommand(new VoteCommand(this.runningPolls), this);
        cmd.registerCommand(new StrawpollCommand(), this);

        const perm = PermissionSystem.getInstance();
        perm.registerPermission(new Permission("polls.vote", Role.NORMAL));
        perm.registerPermission(new Permission("polls.run", Role.MODERATOR));
        perm.registerPermission(new Permission("polls.stop", Role.MODERATOR));
        perm.registerPermission(new Permission("polls.results", Role.MODERATOR));
        perm.registerPermission(new Permission("polls.strawpoll.check", Role.MODERATOR));
        perm.registerPermission(new Permission("polls.strawpoll.create", Role.MODERATOR));

        const settings = SettingsSystem.getInstance();
        settings.registerSetting(new Setting("polls.announceVotes", "true", SettingType.BOOLEAN));
        settings.registerSetting(new Setting("polls.spamStrawpollLink", "5", SettingType.INTEGER));
    }
}
