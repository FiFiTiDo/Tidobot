import AbstractModule from "./AbstractModule";
import CommandModule, {CommandEvent} from "./CommandModule";
import Dispatcher from "../Event/Dispatcher";
import Event from "../Event/Event";
import Message from "../Chat/Message";
import {generate_random_code} from "../Utilities/functions";
import * as util from "util";
import Application from "../Application/Application";

export default class ConfirmationModule extends AbstractModule {
    private readonly confirmations: { [userId: string]: Confirmation };

    constructor() {
        super(ConfirmationModule.name);

        this.coreModule = true;
        this.confirmations = {};
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);
        cmd.registerCommand("confirm", this.confirmCmd, this);
    }

    async make(message: Message, prompt: string, seconds: number): Promise<Confirmation> {
        let chatter = message.getChatter();
        let code = generate_random_code(6);
        let confirmation = new Confirmation(seconds, code);
        confirmation.addListener(ExpiredEvent, () => {
            delete this.confirmations[chatter.getId()];
        });
        this.confirmations[chatter.getId()] = confirmation;

        await message.reply(prompt);
        await message.reply(util.format("Run %sconfirm %s within %d seconds to verify your decision.",
            (await this.getModuleManager().getModule(CommandModule).getPrefix(message.getChannel())), code, seconds
        ));
        await message.reply("Warning: this action might not be able to be undone.");

        return confirmation;
    }

    confirmCmd(event: CommandEvent) {
        let msg = event.getMessage();
        let userId = msg.getChatter().getId();
        if (!this.confirmations.hasOwnProperty(userId)) {
            return msg.reply("No confirmation found, it may have expired.");
        }

        if (event.getArgumentCount() < 1) {
            return msg.reply("You need to specify the confirmation code to confirm.");
        }

        if (this.confirmations[userId].check(event.getArgument(0))) {
            this.confirmations[userId].confirm();
            delete this.confirmations[userId];
        }
    }

    static async make(message: Message, prompt: string, seconds: number): Promise<Confirmation> {
        return Application.getModuleManager().getModule(ConfirmationModule).make(message, prompt, seconds);
    }
}


export class Confirmation extends Dispatcher {
    private confirmed: boolean;
    private readonly seconds: number;
    private expired: boolean = false;
    private readonly code: string;

    constructor(seconds: number, code: string) {
        super();

        this.confirmed = false;
        this.seconds = seconds;
        this.code = code;
    }

    run() {
        setTimeout(() => {
            if (!this.confirmed)
                this.dispatch(new ExpiredEvent());
        }, 1000 * this.seconds);
    }

    isExpired() {
        return this.expired;
    }

    isConfirmed() {
        return this.confirmed;
    }

    confirm() {
        this.confirmed = true;
        this.dispatch(new ConfirmedEvent());
    }

    check(code: string) {
        return this.code === code;
    }

    getCode() {
        return this.code;
    }
}

export class ConfirmedEvent extends Event<ConfirmedEvent> {
    public static readonly NAME = "confirmed";

    constructor() {
        super(ConfirmedEvent.NAME);
    }
}

export class ExpiredEvent extends Event<ExpiredEvent> {
    public static readonly NAME = "expired";

    constructor() {
        super(ExpiredEvent.NAME);
    }
}