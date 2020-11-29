import AbstractModule, {Symbols} from "./AbstractModule";
import Dispatcher from "../Systems/Event/Dispatcher";
import Event from "../Systems/Event/Event";
import Message from "../Chat/Message";
import CommandSystem from "../Systems/Commands/CommandSystem";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import Command from "../Systems/Commands/Command";
import {generateRandomCode} from "../Utilities/RandomUtils";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import {ResponseArg, Sender} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import Container, { Inject, Service, Token } from "typedi";
import { EntityStateList } from "../Database/EntityStateList";
import { Chatter } from "../Database/Entities/Chatter";

export const MODULE_INFO = {
    name: "Confirmation",
    version: "1.2.0",
    description: "An added confirmation layer to actions that cannot be undone and are of great magnitude"
};

type Confirmations = EntityStateList<Chatter, Confirmation>;
const ConfirmationsToken = new Token<Confirmations>("Confirmations");
Container.set(ConfirmationsToken, new EntityStateList<Chatter, Confirmation>(null));

export class ConfirmedEvent {
    public static readonly EVENT_TYPE = "modules.confirmation.ConfirmedEvent";
}

export class ExpiredEvent {
    public static readonly EVENT_TYPE = "modules.confirmation.ExpiredEvent";
}

export class Confirmation extends Dispatcher {
    private confirmed: boolean;
    private readonly seconds: number;
    private readonly code: string;

    constructor(seconds: number, code: string) {
        super();

        this.confirmed = false;
        this.seconds = seconds;
        this.code = code;
    }

    run(): void {
        setTimeout(() => {
            if (!this.confirmed) return this.dispatch(new Event(ConfirmedEvent));
        }, 1000 * this.seconds);
    }

    confirm(): void {
        this.confirmed = true;
        this.dispatch(new Event(ConfirmedEvent)).then();
    }

    check(code: string): boolean {
        return this.code === code;
    }
}

export interface ConfirmationFactory {
    (message: Message, prompt: string, seconds: number): Promise<Confirmation>;
}

@Service()
class ConfirmCommand extends Command {
    constructor(
        @Inject(ConfirmationsToken) private confirmations: Confirmations
    ) {
        super("confirm", "<code>");
    }

    @CommandHandler("confirm", "confirm <code>")
    handleConfirm(event: Event, @Sender sender: Chatter, @ResponseArg response: Response): Promise<any> {
        if (!this.confirmations.has(sender)) return response.message("confirmation:error.expired");
        const args = event.extra.get(CommandEvent.EXTRA_ARGUMENTS);
        if (args.length < 1) return response.message("confirmation:error.no-code");

        const confirmation = this.confirmations.get(sender);
        if (confirmation.check(args[0])) {
            confirmation.confirm();
            this.confirmations.delete(sender);
        }
    }
}

@Service()
export default class ConfirmationModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor(
        confirmCommand: ConfirmCommand, @Inject(ConfirmationsToken) private readonly confirmations: Confirmations
    ) {
        super(ConfirmationModule);

        this.coreModule = true;
        this.registerCommand(confirmCommand);
    }

    async make(message: Message, prompt: string, seconds: number): Promise<Confirmation> {
        const chatter = message.getChatter();
        const code = generateRandomCode(6);
        const confirmation = new Confirmation(seconds, code);
        confirmation.addListener(ExpiredEvent, () => this.confirmations.delete(chatter));
        this.confirmations.set(chatter, confirmation);

        await message.getResponse().rawMessage(prompt);
        await message.getResponse().message("confirmation:time", {
            prefix: CommandSystem.getPrefix(message.getChannel()), code, seconds
        });
        await message.getResponse().message("confirmation:warning");

        return confirmation;
    }
}