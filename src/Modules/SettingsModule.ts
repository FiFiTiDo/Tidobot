import AbstractModule from "./AbstractModule";
import CommandModule, {Command, CommandEventArgs} from "./CommandModule";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import ExpressionModule from "./ExpressionModule";
import {Key} from "../Utilities/Translator";
import PermissionSystem from "../Systems/Permissions/PermissionSystem";
import {Role} from "../Systems/Permissions/Role";
import Permission from "../Systems/Permissions/Permission";
import Logger from "../Utilities/Logger";
import SettingsEntity from "../Database/Entities/SettingsEntity";
import SettingsSystem from "../Systems/Settings/SettingsSystem";
import {ConvertedSetting} from "../Systems/Settings/Setting";
import {EventHandler} from "../Systems/Event/decorators";
import {NewChannelEvent} from "../Chat/NewChannelEvent";

class SetCommand extends Command {
    constructor() {
        super("set", "<setting> <value>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "set <setting> <value>",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true
                },
                {
                    value: {
                        type: "string",
                    },
                    required: true,
                    greedy: true
                }
            ],
            permission: "settings.set"
        });
        if (args === null) return;
        const [key, value] = args;

        msg.getChannel().getSettings().set(key, value)
            .then(() => response.message(Key("settings.set.successful"), key, value))
            .catch(e => {
                response.message(Key("settings.set.failed"), key);
                Logger.get().error("Unable to set setting", {cause: e});
            });
    }
}

class UnsetCommand extends Command {
    constructor() {
        super("unset", "<setting>");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "unset <setting>",
            arguments: [
                {
                    value: {
                        type: "string",
                    },
                    required: true
                }
            ],
            permission: "settings.reset"
        });
        if (args === null) return;
        const key = args[0];
        msg.getChannel().getSettings().unset(key)
            .then(() => response.message(Key("settings.unset.successful"), key))
            .catch(e => {
                response.message(Key("settings.unset.failed"), key);
                Logger.get().error("Unable to unset setting", {cause: e});
            });
    }
}

class ResetCommand extends Command {
    constructor(private confirmationFactory: ConfirmationFactory) {
        super("reset", "");
    }

    async execute({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "reset-settings",
            permission: "settings.reset.all"
        });
        if (args === null) return;

        const confirmation = await this.confirmationFactory(msg, response.translate(Key("settings.reset.confirmation")), 30);
        confirmation.addListener(ConfirmedEvent, () => {
            msg.getChannel().getSettings().reset()
                .then(() => response.message(Key("settings.reset.successful")))
                .catch((e) => {
                    response.message(Key("settings.reset.failed"));
                    Logger.get().error("Unable to reset the channel's settings", {cause: e});
                });
        });
        confirmation.run();
    }
}

export default class SettingsModule extends AbstractModule {
    constructor() {
        super(SettingsModule.name);

        this.coreModule = true;
    }

    initialize(): void {
        const cmd = this.getModuleManager().getModule(CommandModule);
        const perm = PermissionSystem.getInstance();

        perm.registerPermission(new Permission("settings.set", Role.MODERATOR));
        perm.registerPermission(new Permission("settings.reset", Role.BROADCASTER));
        perm.registerPermission(new Permission("settings.reset.all", Role.BROADCASTER));

        cmd.registerCommand(new SetCommand(), this);
        cmd.registerCommand(new UnsetCommand(), this);
        cmd.registerCommand(new ResetCommand(this.makeConfirmation), this);

        this.getModuleManager().getModule(ExpressionModule).registerResolver(msg => ({
            settings: {
                get: async <T> (key: string, defVal?: T): Promise<ConvertedSetting|T|null> => {
                    if (defVal === undefined) defVal = null;
                    const value = msg.getChannel().getSetting(key);
                    return value === null ? defVal : value;
                }
            }
        }));
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({ channel }: NewChannelEvent.Arguments): Promise<void> {
        await SettingsEntity.createTable({ channel });
        await SettingsEntity.make({ channel },
            SettingsSystem.getInstance().getAll().map(setting => ({
                key: setting.getKey(),
                value: setting.getDefaultValue(),
                type: setting.getType(),
                default_value: setting.getDefaultValue()
            }))
        );
    }
}