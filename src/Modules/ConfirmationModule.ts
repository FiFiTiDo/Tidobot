import AbstractModule, {Symbols} from "./AbstractModule";
import Dispatcher from "../Systems/Event/Dispatcher";
import Event from "../Systems/Event/Event";
import Message from "../Chat/Message";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import Command from "../Systems/Commands/Command";
import {generateRandomCode} from "../Utilities/RandomUtils";
import {command} from "../Systems/Commands/decorators";
import EntityStateList from "../Database/EntityStateList";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import {ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";

export const MODULE_INFO = {
    name: "Confirmation",
    version: "1.1.1",
    description: "An added confirmation layer to actions that cannot be undone and are of great magnitude"
};

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
    constructor(private confirmations: EntityStateList<ChatterEntity, Confirmation>) {
        super("confirm", "<code>");
    }

    @CommandHandler("confirm", "confirm <code>")
    handleConfirm(event: CommandEvent, @Sender sender: ChatterEntity, @ResponseArg response: Response): Promise<any> {
        if (!this.confirmations.has(sender)) return response.message("confirmation:error.expired");
        if (event.getArgumentCount() < 1) return response.message("confirmation:error.no-code");

        const confirmation = this.confirmations.get(sender);
        if (confirmation.check(event.getArgument(0))) {
            confirmation.confirm();
            this.confirmations.delete(sender);
        }
    }
}

export default class ConfirmationModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    readonly confirmations: EntityStateList<ChatterEntity, Confirmation>;

    constructor() {
        super(ConfirmationModule);

        this.coreModule = true;
        this.confirmations = new EntityStateList<ChatterEntity, Confirmation>(null);
    }

    @command confirmCommand = new ConfirmCommand(this.confirmations);

    async make(message: Message, prompt: string, seconds: number): Promise<Confirmation> {
        const chatter = message.getChatter();
        const code = generateRandomCode(6);
        const confirmation = new Confirmation(seconds, code);
        confirmation.addListener(ExpiredEvent, () => this.confirmations.delete(chatter));
        this.confirmations.set(chatter, confirmation);

        await message.getResponse().rawMessage(prompt);
        await message.getResponse().message("confirmation:time", {
            prefix: await CommandSystem.getPrefix(message.getChannel()),
            code, seconds
        });
        await message.getResponse().message("confirmation:warning");

        return confirmation;
    }
}