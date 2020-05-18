import AbstractModule from "./AbstractModule";
import Dispatcher from "../Systems/Event/Dispatcher";
import Event from "../Systems/Event/Event";
import Message from "../Chat/Message";
import {ChatterStateList} from "../Database/Entities/ChatterEntity";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import Command from "../Systems/Commands/Command";
import {generateRandomCode} from "../Utilities/RandomUtils";

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
}

export interface ConfirmationFactory {
    (message: Message, prompt: string, seconds: number): Promise<Confirmation>;
}

class ConfirmCommand extends Command {
    constructor(private confirmations: ChatterStateList<Confirmation>) {
        super("confirm", "<code>");
    }

    execute({event, message, response}: CommandEventArgs): Promise<any> {
        if (!this.confirmations.hasChatter(message.getChatter())) return response.message("confirmation:error.expired");
        if (event.getArgumentCount() < 1) return response.message("confirmation:error.no-code");

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
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new ConfirmCommand(this.confirmations), this);
    }

    async make(message: Message, prompt: string, seconds: number): Promise<Confirmation> {
        const chatter = message.getChatter();
        const code = generateRandomCode(6);
        const confirmation = new Confirmation(seconds, code);
        confirmation.addListener(ExpiredEvent, () => this.confirmations.removeChatter(chatter));
        this.confirmations.setChatter(chatter, confirmation);

        await message.getResponse().rawMessage(prompt);
        await message.getResponse().message("confirmation:time", {
            prefix: await CommandSystem.getPrefix(message.getChannel()),
            code, seconds
        });
        await message.getResponse().message("confirmation:warning");

        return confirmation;
    }
}