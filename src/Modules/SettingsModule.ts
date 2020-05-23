import AbstractModule, {ModuleInfo, Systems} from "./AbstractModule";
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
import {string} from "../Systems/Commands/Validator/String";
import {ValidatorStatus} from "../Systems/Commands/Validator/Strategies/ValidationStrategy";
import StandardValidationStrategy from "../Systems/Commands/Validator/Strategies/StandardValidationStrategy";
import {tuple} from "../Utilities/ArrayUtils";
import {getLogger} from "log4js";

export const MODULE_INFO = {
    name: "Settings",
    version: "1.0.0",
    description: "Manage the channel's settings to change the functionality of the bot"
};

const logger = getLogger(MODULE_INFO.name);

class SetCommand extends Command {
    constructor() {
        super("set", "<setting> <value>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "set <setting> <value>",
            arguments: tuple(
                string({ name: "setting", required: true }),
                string({ name: "value", required: true, greedy: true })
            ),
            permission: "settings.set"
        }));
         if (status !== ValidatorStatus.OK) return;
        const [key, value] = args;

        msg.getChannel().getSettings().set(key, value)
            .then(() => response.message("setting:set", {setting: key, value}))
            .catch(e => {
                response.genericError();
                logger.error("Unable to set setting");
            logger.trace("Caused by: " + e.message);
            });
    }
}

class UnsetCommand extends Command {
    constructor() {
        super("unset", "<setting>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {args, status} = await event.validate(new StandardValidationStrategy({
            usage: "unset <setting>",
            arguments: tuple(
                string({ name: "setting", required: true })
            ),
            permission: "settings.reset"
        }));
         if (status !== ValidatorStatus.OK) return;
        const key = args[0];
        msg.getChannel().getSettings().unset(key)
            .then(() => response.message("setting:unset", {setting: key}))
            .catch(e => {
                response.genericError();
                logger.error("Unable to unset setting");
            logger.trace("Caused by: " + e.message);
            });
    }
}

class ResetCommand extends Command {
    constructor(private confirmationFactory: ConfirmationFactory) {
        super("reset", "");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const {status} = await event.validate(new StandardValidationStrategy({
            usage: "reset-settings",
            permission: "settings.reset.all"
        }));
         if (status !== ValidatorStatus.OK) return;

        const confirmation = await this.confirmationFactory(msg, await response.translate("setting:confirm-reset"), 30);
        confirmation.addListener(ConfirmedEvent, () => {
            msg.getChannel().getSettings().reset()
                .then(() => response.message("setting:reset"))
                .catch((e) => {
                    response.genericError();
                    logger.error("Unable to reset the channel's settings");
            logger.trace("Caused by: " + e.message);
                });
        });
        confirmation.run();
    }
}

@HandlesEvents()
export default class SettingsModule extends AbstractModule {
    constructor(@inject(symbols.ConfirmationFactory) private makeConfirmation: ConfirmationFactory) {
        super(SettingsModule.name);

        this.coreModule = true;
    }

    initialize({ command, permission, expression }: Systems): ModuleInfo {
        command.registerCommand(new SetCommand(), this);
        command.registerCommand(new UnsetCommand(), this);
        command.registerCommand(new ResetCommand(this.makeConfirmation), this);
        permission.registerPermission(new Permission("settings.set", Role.MODERATOR));
        permission.registerPermission(new Permission("settings.reset", Role.BROADCASTER));
        permission.registerPermission(new Permission("settings.reset.all", Role.BROADCASTER));
        expression.registerResolver(msg => ({
            settings: {
                get: async <T>(key: string, defVal?: T): Promise<ConvertedSetting | T | null> => {
                    if (defVal === undefined) defVal = null;
                    const value = msg.getChannel().getSetting(key);
                    return value === null ? defVal : value;
                }
            }
        }));

        return MODULE_INFO;
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