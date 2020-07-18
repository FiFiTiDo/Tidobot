import AbstractModule, {Symbols} from "./AbstractModule";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import SettingsEntity from "../Database/Entities/SettingsEntity";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import {ConvertedSetting, SettingType} from "../Systems/Settings/Setting";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {inject} from "inversify";
import symbols from "../symbols";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import {string} from "../Systems/Commands/Validation/String";
import {ValidatorStatus} from "../Systems/Commands/Validation/Strategies/ValidationStrategy";
import StandardValidationStrategy from "../Systems/Commands/Validation/Strategies/StandardValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";
import {getLogger, logError} from "../Utilities/Logger";
import {command} from "../Systems/Commands/decorators";
import {permission} from "../Systems/Permissions/decorators";
import Message from "../Chat/Message";
import {ExpressionContext} from "../Systems/Expressions/ExpressionSystem";
import {ExpressionContextResolver} from "../Systems/Expressions/decorators";
import {logErrorOnFail, validateFunction} from "../Utilities/ValidateFunction";

export const MODULE_INFO = {
    name: "Settings",
    version: "1.0.0",
    description: "Manage the channel's settings to change the functionality of the bot"
};

const logger = getLogger(MODULE_INFO.name);

class SetCommand extends Command {
    constructor(private readonly settingsModule: SettingsModule) {
        super("set", "<setting> <value>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "set <setting> <value>",
            arguments: tuple(
                string({ name: "setting", required: true }),
                string({ name: "value", required: true, greedy: true })
            ),
            permission: this.settingsModule.setSetting
        }));
         if (status !== ValidatorStatus.OK) return;
        const [key, value] = args;

        msg.getChannel().getSettings().set(key, value)
            .then(() => response.message("setting:set", {setting: key, value}))
            .catch(e => {
                response.genericError();
                logError(logger, e, "Unable to set setting");
            });
    }
}

class UnsetCommand extends Command {
    constructor(private readonly settingsModule: SettingsModule) {
        super("unset", "<setting>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "unset <setting>",
            arguments: tuple(
                string({ name: "setting", required: true })
            ),
            permission: this.settingsModule.resetSetting
        }));
         if (status !== ValidatorStatus.OK) return;
        const key = args[0];
        msg.getChannel().getSettings().unset(key)
            .then(() => response.message("setting:unset", {setting: key}))
            .catch(e => {
                response.genericError();
                logError(logger, e, "Unable to unset setting");
            });
    }
}

class ResetCommand extends Command {
    constructor(private readonly settingsModule: SettingsModule) {
        super("reset", "");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "reset-settings",
            permission: this.settingsModule.resetAllSettings
        }));
         if (status !== ValidatorStatus.OK) return;

        const confirmation = await this.settingsModule.makeConfirmation(msg, await response.translate("setting:confirm-reset"), 30);
        confirmation.addListener(ConfirmedEvent, () => {
            msg.getChannel().getSettings().reset()
                .then(() => response.message("setting:reset"))
                .catch((e) => {
                    response.genericError();
                    logError(logger, e, "Unable to reset the channel's settings");
                });
        });
        confirmation.run();
    }
}

@HandlesEvents()
export default class SettingsModule extends AbstractModule {
    static [Symbols.ModuleInfo] = MODULE_INFO;

    constructor(@inject(symbols.ConfirmationFactory) public makeConfirmation: ConfirmationFactory) {
        super(SettingsModule);

        this.coreModule = true;
    }

    @command setCommand = new SetCommand(this);
    @command unsetCommand = new UnsetCommand(this);
    @command resetCommand = new ResetCommand(this);

    @permission setSetting = new Permission("settings.set", Role.MODERATOR);
    @permission resetSetting = new Permission("settings.reset", Role.BROADCASTER);
    @permission resetAllSettings = new Permission("settings.reset.all", Role.BROADCASTER);

    @ExpressionContextResolver
    expressionContextResolver(msg: Message): ExpressionContext {
        return {
            settings: {
                get: validateFunction(async <T>(key: string, defVal?: T = null): Promise<ConvertedSetting | T | null> => {
                    return msg.getChannel().getSetting(key) ?? defVal;
                }, ["string|required", ""], logErrorOnFail(logger, Promise.resolve(null)))
            }
        }
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await SettingsEntity.createTable({channel});
        await SettingsEntity.make({channel},
            SettingsSystem.getInstance().getAll().map(setting => {
                return {
                    key: setting.getKey(),
                    value: setting.getDefaultValue(),
                    type: SettingType[setting.getType()],
                    default_value: setting.getDefaultValue()
                }
            })
        );
    }
}