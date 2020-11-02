import AbstractModule, {Symbols} from "./AbstractModule";
import ConfirmationModule, {ConfirmedEvent} from "./ConfirmationModule";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Setting, {ConvertedSetting} from "../Systems/Settings/Setting";
import Command from "../Systems/Commands/Command";
import {CommandEvent} from "../Systems/Commands/CommandEvent";
import {getLogger} from "../Utilities/Logger";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";
import {logErrorOnFail, validateFunction} from "../Utilities/ValidateFunction";
import {CommandHandler} from "../Systems/Commands/Validation/CommandHandler";
import CheckPermission from "../Systems/Commands/Validation/CheckPermission";
import {Argument, ChannelArg, MessageArg, ResponseArg, RestArguments} from "../Systems/Commands/Validation/Argument";
import {Response} from "../Chat/Response";
import Container, { Service } from "typedi";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import { Channel } from "../Database/Entities/Channel";
import { InvalidArgumentError } from "../Systems/Commands/Validation/ValidationErrors";

export const MODULE_INFO = {
    name: "Settings",
    version: "1.2.0",
    description: "Manage the channel's settings to change the functionality of the bot"
};

const logger = getLogger(MODULE_INFO.name);
class SettingArg {
    static type = "setting";

    static convert(input: string, name: string, column: number): Setting<any> {
        const setting = Container.get(SettingsSystem).getSetting(input);
        if (setting === null)
            throw new InvalidArgumentError(name, "setting", input, column);
        return setting;
    }
}

@Service()
class SetCommand extends Command {
    constructor() {
        super("set", "<setting> <value>");
    }

    @CommandHandler("set", "set <key> <value>")
    @CheckPermission(() => SettingsModule.permissions.setSetting)
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: Channel,
        @Argument(SettingArg) setting: Setting<any>, @RestArguments(true, {join: " "}) value: string
    ): Promise<void> {
        channel.settings.set(setting, value);
        return channel.settings.save()
            .then(() => response.message("setting:set", {setting: setting.key, value}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }
}

@Service()
class UnsetCommand extends Command {
    constructor() {
        super("unset", "<setting>");
    }

    @CommandHandler("unset", "unset <key>")
    @CheckPermission(() => SettingsModule.permissions.resetSetting)
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: Channel, @Argument(SettingArg) setting: Setting<any>
    ): Promise<void> {
        channel.settings.unset(setting);
        return channel.settings.save()
            .then(() => response.message("setting:unset", {setting: setting.key}))
            .catch(e => response.genericErrorAndLog(e, logger));
    }
}

@Service()
class ResetCommand extends Command {
    constructor(private readonly confirmationModule: ConfirmationModule, private readonly settingsSystem: SettingsSystem) {
        super("reset", "");
    }

    @CommandHandler("reset", "reset")
    @CheckPermission(() => SettingsModule.permissions.resetAllSettings)
    async handleCommand(
        event: CommandEvent, @ResponseArg response: Response, @ChannelArg channel: Channel, @MessageArg msg: Message
    ): Promise<void> {
        const confirmMsg = await response.translate("setting:confirm-reset");
        const confirm = await this.confirmationModule.make(msg, confirmMsg, 30);
        confirm.addListener(ConfirmedEvent, () => {
            channel.settings.reset();
            return channel.settings.save()
                .then(() => response.message("setting:reset"))
                .catch(e => response.genericErrorAndLog(e, logger));
        });
        confirm.run();
    }
}

@Service()
export default class SettingsModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;
    static permissions = {
        setSetting: new Permission("settings.set", Role.MODERATOR),
        resetSetting: new Permission("settings.reset", Role.BROADCASTER),
        resetAllSettings: new Permission("settings.reset.all", Role.BROADCASTER)
    }

    constructor(setCommand: SetCommand, unsetCommand: UnsetCommand, resetCommand: ResetCommand, private readonly settingsSystem: SettingsSystem) {
        super(SettingsModule);

        this.coreModule = true;
        this.registerCommands(setCommand, unsetCommand, resetCommand);
        this.registerPermissions(SettingsModule.permissions);
    }

    @ExpressionContextResolver
    expressionContextResolver(msg: Message): ExpressionContext {
        return {
            settings: {
                get: validateFunction(async <T>(key: string, defVal: T = null): Promise<ConvertedSetting | T | null> => {
                    const setting = this.settingsSystem.getSetting(key);
                    if (setting === null) return defVal;
                    return msg.channel.settings.get(setting) ?? defVal;
                }, ["string|required", ""], logErrorOnFail(logger, Promise.resolve(null)))
            }
        };
    }
}