import AbstractModule from "../../Modules/AbstractModule";
import {EventHandler, HandlesEvents} from "../Event/decorators";
import ChannelEntity from "../../Database/Entities/ChannelEntity";
import Message from "../../Chat/Message";
import {Key} from "../../Utilities/Translator";
import MessageEvent from "../../Chat/Events/MessageEvent";
import {EventArguments} from "../Event/Event";
import EventSystem from "../Event/EventSystem";
import {objectHasProperties} from "../../Utilities/ObjectUtils";
import Command from "./Command";
import {CommandEvent, CommandEventArgs} from "./CommandEvent";
import SettingsSystem from "../Settings/SettingsSystem";
import Setting, {SettingType} from "../Settings/Setting";

export interface CommandListener {
    (event: CommandEventArgs): void;
}

export interface CommandGroup {
    command: Command;
    module: AbstractModule;
}

@HandlesEvents()
export default class CommandSystem {
    private static instance: CommandSystem = null;

    public static getInstance(): CommandSystem {
        if (this.instance === null)
            this.instance = new CommandSystem();

        return this.instance;
    }

    private readonly commandListeners: { [key: string]: CommandGroup[] };

    constructor() {
        this.commandListeners = {};
        SettingsSystem.getInstance().registerSetting(new Setting("command.prefix", "!", SettingType.STRING));
    }

    static async getPrefix(channel: ChannelEntity): Promise<string> {
        return await channel.getSettings().get("command.prefix");
    }

    static async showInvalidSyntax(usage: string, msg: Message): Promise<void> {
        await msg.getResponse().message("command:error.syntax", {
            prefix: await this.getPrefix(msg.getChannel()),
            usage
        });
    }

    static async showInvalidArgument(argument: string, given: any, usage: string, msg: Message): Promise<void> {
        await msg.getResponse().message("command:error.argument-arg", {
            argument, given,
            prefix: await this.getPrefix(msg.getChannel()),
            usage
        });
    }

    @EventHandler(MessageEvent)
    async handleMessage({event}: EventArguments<MessageEvent>): Promise<void> {
        const message: Message = event.getMessage();
        const commandPrefix = await CommandSystem.getPrefix(message.getChannel());

        if (message.getParts().length < 1) return;
        if (message.getPart(0).startsWith(commandPrefix)) {
            const commandLabel = message.getPart(0).toLowerCase().substring(commandPrefix.length);
            const event = new CommandEvent(message.getPart(0), message.getParts().slice(1), message);

            EventSystem.getInstance().dispatch(event);
            if (objectHasProperties(this.commandListeners, commandLabel))
                for (const commandGroup of this.commandListeners[commandLabel])
                    if (!commandGroup.module.isDisabled(event.getMessage().getChannel()))
                        await commandGroup.command.execute(event.getEventArgs());
        }
    }

    registerCommand(command: Command, module: AbstractModule): void {
        const register = (label: string): void => {
            if (!objectHasProperties(this.commandListeners, label)) this.commandListeners[label] = [];
            this.commandListeners[label].push({ command, module });
        };

        register(command.getLabel().toLowerCase());
        for (const alias of command.getAliases())
            register(alias.toLowerCase());
    }
}



