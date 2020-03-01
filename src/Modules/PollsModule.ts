import AbstractModule from "./AbstractModule";
import Chatter from "../Chat/Chatter";
import CommandModule, {CommandEvent, SubcommandHelper} from "./CommandModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import {__, spam_message} from "../Utilities/functions";
import SettingsModule from "./SettingsModule";
import Message from "../Chat/Message";
import request = require("request-promise-native");

interface StrawpollGetResponse {
    id: number,
    title: string,
    multi: boolean,
    options: string[],
    votes: number[]
}

interface StrawpollPostResponse {
    id: number,
    title: string,
    options: string[],
    multi: boolean,
    dupcheck: string,
    captcha: boolean
}

export default class PollsModule extends AbstractModule {
    private lastStrawpoll: Map<string, number>;
    private runningPolls: Map<string, Poll>;

    constructor() {
        super(PollsModule.name);

        this.runningPolls = new Map();
        this.lastStrawpoll = new Map();
    }

    initialize() {
        let cmd = this.getModuleManager().getModule(CommandModule);
        cmd.registerCommand("poll", this.pollCmd, this);
        cmd.registerCommand("vote", this.voteCmd, this);
        cmd.registerCommand("strawpoll", this.strawpollCmd, this);

        let perm = this.getModuleManager().getModule(PermissionModule);
        perm.registerPermission("polls.vote", PermissionLevel.NORMAL);
        perm.registerPermission("polls.run", PermissionLevel.MODERATOR);
        perm.registerPermission("polls.stop", PermissionLevel.MODERATOR);
        perm.registerPermission("polls.results", PermissionLevel.MODERATOR);
        perm.registerPermission("polls.strawpoll.check", PermissionLevel.MODERATOR);
        perm.registerPermission("polls.strawpoll.create", PermissionLevel.MODERATOR);

        let settings = this.getModuleManager().getModule(SettingsModule);
        settings.registerSetting("polls.announceVotes", "true", "boolean");
        settings.registerSetting("polls.spamStrawpollLink", "5", "integer");
    }

    async strawpollCmd(event: CommandEvent) {
        new SubcommandHelper.Builder()
            .addSubcommand("create", this.createStrawpoll)
            .addSubcommand("check", this.checkStrawpoll)
            .showUsageOnDefault("strawpoll <create|check>")
            .build(this)
            .handle(event)
    }

    async checkStrawpoll(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "strawpoll check [poll id]",
            arguments: [
                {
                    type: "integer",
                    required: false
                }
            ]
        });
        if (args === null) return;

        let pollId;
        if (args.length < 1) {
            if (!this.lastStrawpoll.has(msg.getChannel().getId())) {
                await msg.reply(__("polls.strawpoll.not_found"));
                return;
            }

            pollId = this.lastStrawpoll.get(msg.getChannel().getId());
        } else {
            pollId = args[0];
        }

        let res: StrawpollGetResponse = await request({
            uri: "https://www.strawpoll.me/api/v2/polls/" + pollId,
            json: true
        }).promise();

        let total = res.votes.reduce((prev, next) => prev + next);
        let response = res.options.map((option, index) => option + ": " + ((res.votes[index] / total) * 100) + "%").join(", ");
        await msg.reply(__("polls.results", response));
    };

    async createStrawpoll(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "strawpoll create --title \"title\" <option 1> <option 2> ... [option n]",
            arguments: [
                {
                    type: "string",
                    required: true,
                    key: "title"
                },
                {
                    type: "string",
                    required: true,
                    key: "_"
                },
                {
                    type: "boolean",
                    required: false,
                    defaultValue: "false",
                    key: "multi"
                },
                {
                    type: "string",
                    required: false,
                    accepted: ["normal", "permissive", "disabled"],
                    defaultValue: "normal",
                    key: "dupcheck"
                },
                {
                    type: "boolean",
                    required: false,
                    defaultValue: "false",
                    key: "captcha"
                }
            ],
            cli_args: true,
            permission: "polls.strawpoll.create"
        });
        if (args === null) return;
        let { title, _: options, multi, dupcheck, captcha } = args;

        if (options.length < 2) return msg.reply(__("polls.strawpoll.no_options"));

        let resp: StrawpollPostResponse = await request({
            uri: "https://www.strawpoll.me/api/v2/polls",
            method: "post",
            json: true,
            body: { title, options, multi, dupcheck, captcha }
        }).promise();

        let times = await msg.getChannel().getSettings().get("polls.spamStrawpollLink");
        if (isNaN(times)) times = 1;
        await spam_message(__("polls.strawpoll.created", "https://www.strawpoll.me/" + resp.id), msg.getChannel(), times);
    };

    async voteCmd(event: CommandEvent) {
        let msg = event.getMessage();
        let announce = await msg.getChannel().getSettings().get("polls.announceVotes");
        let args = await event.validate({
            usage: "vote <option #>",
            arguments: [
                {
                    type: "integer",
                    required: true,
                    silentFail: !announce
                }
            ],
            permission: "polls.vote"
        });
        if (args === null) return;

        if (!this.runningPolls.has(msg.getChannel().getId())) return;
        let poll = this.runningPolls.get(msg.getChannel().getId());
        let optionNum = args[0] as number;

        let option = poll.getOption(optionNum);
        if (option === null) {
            if (announce)
                await this.getModuleManager().getModule(CommandModule).showInvalidArgument("option #", event.getArgument(1), "vote <option #>", msg);
            return;
        }

        let successful = poll.addVote(option, msg.getChatter());
        if (announce)
            return successful ? msg.reply(__("polls.vote_accepted")) : msg.reply(__("polls.already_voted"));
    }

    async pollCmd(event: CommandEvent) {
        new SubcommandHelper.Builder()
            .addSubcommand("run", this.run)
            .addSubcommand("stop", this.stop)
            .addSubcommand("results", this.results)
            .addSubcommand("res", this.results)
            .showUsageOnDefault("poll <run|stop|results>")
            .build(this)
            .handle(event);
    }

    private async getPoll(msg: Message) {
        if (!this.runningPolls.has(msg.getChannel().getId())) {
            await msg.reply(__("polls.not_running", await this.getModuleManager().getModule(CommandModule).getPrefix(msg.getChannel())));
            return;
        }

        return this.runningPolls.get(msg.getChannel().getId());
    }

    async run(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "!poll run <option 1> <option 2> ... <option n>",
            arguments: [
                {
                    type: "string",
                    required: true,
                    array: true
                }
            ],
            permission: "polls.run"
        });
        if (args === null) return;
        let options = args[0] as string[];
        let prefix = await this.getModuleManager().getModule(CommandModule).getPrefix(msg.getChannel());

        if (this.runningPolls.has(msg.getChannel().getId())) {
            await msg.reply(__("polls.already_running", prefix));
            return;
        }

        let poll = new Poll(options);
        this.runningPolls.set(msg.getChannel().getId(), poll);

        await msg.reply(__("polls.open", prefix));
        await msg.reply(__("polls.options", options.map(((value, index) => "#" + (index + 1) + ": " + value))));
    };

    async stop(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "poll stop",
            permission: "polls.stop"
        });
        if (args === null) return;

        let poll = await this.getPoll(msg);
        poll.close();
        await msg.reply(__("polls.closed"));
        await msg.reply(__("polls.drumroll_please"));

        setTimeout(() => {
            let votes = poll.getResults();
            let response = Object.keys(votes).map(option => option + ": " + ((votes[option].length / poll.getTotalVotes()) * 100) + "%").join(", ");
            msg.reply(__("polls.results", response));
        }, 5000);
    };

    async results(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "poll results",
            permission: "polls.results"
        });
        if (args === null) return;

        if (!(await msg.checkPermission("polls.results"))) return;
        let poll = await this.getPoll(msg);
        let votes = poll.getResults();
        let response = Object.keys(votes).map(option => option + ": " + ((votes[option].length / poll.getTotalVotes()) * 100) + "%").join(", ");
        await msg.reply(__("polls.results", response));
    };
}

class Poll {
    private _open: boolean;
    private readonly options: string[];
    private readonly votes: { [key: string]: Chatter[] };
    private userVotes: Map<Chatter, string>;

    constructor(options: string[]) {
        this.options = options;
        this.votes = {};
        this.userVotes = new Map();

        for (let option of options) {
            this.votes[option] = [];
        }
    }

    validateVote(option: string, chatter: Chatter) {
        return this.options.indexOf(option) >= 0 && this.userVotes.has(chatter);
    }

    addVote(option: string, chatter: Chatter) {
        if (!this.validateVote(option, chatter)) return false;
        this.votes[option].push(chatter);
        this.userVotes.set(chatter, option);
        return true;
    }

    removeVote(chatter: Chatter) {
        let option = this.userVotes.get(chatter);
        if (!option) return false;
        this.votes[option].splice(this.votes[option].indexOf(chatter), 1);
        return true;
    }

    isOpen() {
        return this._open;
    }

    open() {
        this._open = true;
    }

    close() {
        this._open = false;
    }

    getOption(index: number) {
        return index < 0 || index >= this.options.length ? null : this.options[index];
    }

    getTotalVotes() {
        return this.userVotes.size;
    }

    getResults() {
        return this.votes;
    }
}