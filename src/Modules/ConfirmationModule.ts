import AbstractModule from "./AbstractModule";
import CommandModule, {Command, CommandEventArgs} from "./CommandModule";
import Dispatcher from "../Systems/Event/Dispatcher";
import Event from "../Systems/Event/Event";
import Message from "../Chat/Message";
import {generate_random_code} from "../Utilities/functions";
import * as util from "util";
import {ChatterStateList} from "../Database/Entities/ChatterEntity";

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

export class Confirmation extends Dispatcher {
    private confirmed: boolean;
    private readonly seconds: number;
    private expired = false;
    private readonly code: string;

    constructor(seconds: number, code: string) {
        super();

        this.confirmed = false;
        this.seconds = seconds;
        this.code = code;
    }

    run(): void {
        setTimeout(() => {
            if (!this.confirmed)
                this.dispatch(new ExpiredEvent());
        }, 1000 * this.seconds);
    }

    isExpired(): boolean {
        return this.expired;
    }

    isConfirmed(): boolean {
        return this.confirmed;
    }

    confirm(): void {
        this.confirmed = true;
        this.dispatch(new ConfirmedEvent());
    }

    check(code: string): boolean {
        return this.code === code;
    }

    getCode(): string {
        return this.code;
    }
}

export interface ConfirmationFactory {
    (message: Message, prompt: string, seconds: number): Promise<Confirmation>;
}

class ConfirmCommand extends Command {
    constructor(private confirmations: ChatterStateList<Confirmation>) {
        super("confirm", "<code>");
    }

    execute({ event, message, response }: CommandEventArgs): Promise<any> {
        if (!this.confirmations.hasChatter(message.getChatter())) return response.message("No confirmation found, it may have expired.");
        if (event.getArgumentCount() < 1) return response.message("You need to specify the confirmation code to confirm.");

        const confirmation = this.confirmations.getChatter(message.getChatter());
        if (confirmation.check(event.getArgument(0))) {
            confirmation.confirm();
            this.confirmations.removeChatter(message.getChatter());
        }
    }
}

export default class ConfirmationModule extends AbstractModule {
    readonly confirmations: ChatterStateList<Confirmation>;

    constructor() {
        super(ConfirmationModule.name);

        this.coreModule = true;
        this.confirmations = new ChatterStateList<Confirmation>(null);
    }

    initialize(): void {
        const cmd = this.moduleManager.getModule(CommandModule);
        cmd.registerCommand(new ConfirmCommand(this.confirmations), this);
    }

    async make(message: Message, prompt: string, seconds: number): Promise<Confirmation> {
        const chatter = message.getChatter();
        const code = generate_random_code(6);
        const confirmation = new Confirmation(seconds, code);
        confirmation.addListener(ExpiredEvent, () => this.confirmations.removeChatter(chatter));
        this.confirmations.setChatter(chatter, confirmation);

        await message.reply(prompt);
        await message.reply(util.format("Run %sconfirm %s within %d seconds to verify your decision.",
            (await CommandModule.getPrefix(message.getChannel())), code, seconds
        ));
        await message.reply("Warning: this action might not be able to be undone.");

        return confirmation;
    }
}