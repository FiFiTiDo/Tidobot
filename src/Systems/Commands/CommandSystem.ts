import AbstractModule from "../../Modules/AbstractModule";
import {EventHandler, HandlesEvents} from "../Event/decorators";
import Message from "../../Chat/Message";
import MessageEvent from "../../Chat/Events/MessageEvent";
import {EventArguments} from "../Event/Event";
import EventSystem from "../Event/EventSystem";
import {objectHasProperties} from "../../Utilities/ObjectUtils";
import Command from "./Command";
import {CommandEvent, CommandEventArgs} from "./CommandEvent";
import SettingsSystem from "../Settings/SettingsSystem";
import Setting, {SettingType} from "../Settings/Setting";
import System from "../System";
import { Service } from "typedi";
import { Channel } from "../../Database/Entities/Channel";

export interface CommandListener {
    (event: CommandEventArgs): void;
}

export interface CommandGroup {
    command: Command;
    module: AbstractModule;
}

const prefixSetting = new Setting("command.prefix", "!", SettingType.STRING);

@HandlesEvents()
@Service()
export default class CommandSystem extends System {
    private readonly commandListeners: { [key: string]: CommandGroup[] };

    constructor(
        private readonly settings: SettingsSystem,
        private readonly eventSystem: EventSystem
    ) {
        super("Command");
        this.settings.registerSetting(prefixSetting);
        this.commandListeners = {};
    }

    static getPrefix(channel: Channel): string {
        return channel.settings.get(prefixSetting);
    }

    static async showInvalidArgument(argument: string, given: any, usage: string, msg: Message): Promise<void> {
        await msg.getResponse().message("command:error.argument-arg", {
            argument, given,
            prefix: this.getPrefix(msg.getChannel()),
            usage
        });
    }

    @EventHandler(MessageEvent)
    async handleMessage({event}: EventArguments<MessageEvent>): Promise<void> {
        const message = event.getMessage();
        const channel = message.getChannel();
        const commandPrefix = CommandSystem.getPrefix(channel);

        if (message.getParts().length < 1) return;
        if (message.getPart(0).startsWith(commandPrefix)) {
            const commandLabel = message.getPart(0).toLowerCase().substring(commandPrefix.length);

            this.eventSystem.dispatch(event);
            if (objectHasProperties(this.commandListeners, commandLabel)) {
                channel.logger.debug(`Command ${commandLabel} executed by ${message.chatter.user.name}`);
                for (const commandGroup of this.commandListeners[commandLabel]) {
                    const event = new CommandEvent(message.getPart(0), message.getParts().slice(1), message, commandGroup.command);
                    if (!commandGroup.module.isDisabled(event.getMessage().getChannel()))
                        await commandGroup.command.execute(event.getEventArgs());
                }
            }
        }
    }

    registerCommand(command: Command, module: AbstractModule): void {
        const register = (label: string): void => {
            if (!objectHasProperties(this.commandListeners, label)) this.commandListeners[label] = [];
            this.commandListeners[label].push({command, module});
        };

        register(command.getLabel().toLowerCase());
        for (const alias of command.getAliases())
            register(alias.toLowerCase());
    }
}



