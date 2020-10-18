import AbstractModule, {Symbols} from "./AbstractModule";
import ConfirmationModule, {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import SettingsEntity from "../Database/Entities/SettingsEntity";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import {ConvertedSetting, SettingType} from "../Systems/Settings/Setting";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {StringArg} from "../Systems/Commands/Validation/String";
import {getLogger} from "../Utilities/Logger";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";
import {logErrorOnFail, validateFunction} from "../Utilities/ValidateFunction";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ChannelArg, MessageArg, ResponseArg, RestArguments} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import ChannelEntity from "../Database/Entities/ChannelEntity";
import { Service } from "typedi";

export const MODULE_INFO = {
    name: "Settings",
    version: "1.1.0",
    description: "Manage the channel's settings to change the functionality of the bot"
};

const logger = getLogger(MODULE_INFO.name);

class SetCommand extends Command {
    constructor() {
        super("set", "<setting> <value>");
    }

    @CommandHandler("set", "set <key> <value>")
    @CheckPermission("settings.set")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: ChannelEntity,
        @Argument(StringArg) key: string, @RestArguments(true, {join: " "}) value: string
    ): Promise<void> {
        return channel.setSetting(key, value)
            .then(() => response.message("setting:set", {setting: key, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }
}

class UnsetCommand extends Command {
    constructor() {
        super("unset", "<setting>");
    }

    @CommandHandler("unset", "unset <key>")
    @CheckPermission("settings.reset")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: ChannelEntity, @Argument(StringArg) key: string
    ): Promise<void> {
        return channel.getSettings().unset(key)
            .then(() => response.message("setting:unset", {setting: key}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }
}

class ResetCommand extends Command {
    constructor(private readonly settingsModule: SettingsModule) {
        super("reset", "");
    }

    @CommandHandler("reset", "reset")
    @CheckPermission("settings.reset.all")
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: ChannelEntity, @MessageArg msg: Message
    ): Promise<void> {
        const confirmMsg = await response.translate("setting:confirm-reset");
        const confirm = await this.settingsModule.confirmationModule.make(msg, confirmMsg, 30);
        confirm.addListener(ConfirmedEvent, () => channel.getSettings().reset()
            .then(() => response.message("setting:reset"))
            .catch(e => response.genericErrorAndLog(e, logger))
        );
        confirm.run();
    }
}

@Service()
export default class SettingsModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    @command setCommand = new SetCommand();
    @command unsetCommand = new UnsetCommand();
    @command resetCommand = new ResetCommand(this);
    @permission setSetting = new Permission("settings.set", Role.MODERATOR);
    @permission resetSetting = new Permission("settings.reset", Role.BROADCASTER);
    @permission resetAllSettings = new Permission("settings.reset.all", Role.BROADCASTER);

    constructor(public readonly confirmationModule: ConfirmationModule
) {
        super(SettingsModule);

        this.coreModule = true;
    }

    @ExpressionContextResolver
    expressionContextResolver(msg: Message): ExpressionContext {
        return {
            settings: {
                get: validateFunction(async <T>(key: string, defVal: T = null): Promise<ConvertedSetting | T | null> => {
                    return msg.channel.settings.get(key) ?? defVal;
                }, ["string|required", ""], logErrorOnFail(logger, Promise.resolve(null)))
            }
        }
    }
}