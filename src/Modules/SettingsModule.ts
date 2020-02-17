import AbstractModule from "./AbstractModule";
import PermissionModule, {PermissionLevel} from "./PermissionModule";
import CommandModule, {CommandEvent} from "./CommandModule";
import Application from "../Application/Application";
import Channel from "../Chat/Channel";
import {__} from "../Utilities/functions";
import ConfirmationModule, {ConfirmedEvent} from "./ConfirmationModule";
import ChannelSchemaBuilder from "../Database/ChannelSchemaBuilder";
import ExpressionModule from "./ExpressionModule";
import {Converter} from "../Utilities/Converter";


export default class SettingsModule extends AbstractModule {
    private readonly settings: {
        [key: string]: {
            value: any,
            converter: Converter<string, any>
        }
    };

    constructor() {
        super(SettingsModule.name);

        this.settings = {};
        this.coreModule = true;
    }

    initialize() {
        const cmd = this.getModuleManager().getModule(CommandModule);
        const perm = this.getModuleManager().getModule(PermissionModule);

        perm.registerPermission("settings.set", PermissionLevel.MODERATOR);
        perm.registerPermission("settings.reset", PermissionLevel.BROADCASTER);
        perm.registerPermission("settings.reset.all", PermissionLevel.BROADCASTER);

        cmd.registerCommand("set", this.setCommand, this);
        cmd.registerCommand("unset", this.unsetCommand, this);
        cmd.registerCommand("reset-settings", this.resetCommand, this);

        this.getModuleManager().getModule(ExpressionModule).registerResolver(msg => {
            return {
                settings: {
                    get: async (key: string, defVal?: any) => {
                        if (defVal === undefined) defVal = null;
                        let value = msg.getChannel().getSettings().get(key);
                        return value === null ? defVal : value;
                    }
                }
            }
        });
    }

    createDatabaseTables(builder: ChannelSchemaBuilder) {
        builder.addTable("settings", table => {
            table.string("key").unique();
            table.string("value");
        });
    }

    public async onCreateTables(channel: Channel) {
        await channel.query("settings").insert(Object.entries(this.settings).map(([key, {value}]) => {
            return {key, value};
        })).or("IGNORE").exec();
    }

    registerSetting(setting: string, defaultValue: string, converter: Converter<string, any>) {
        this.settings[setting] = {value: defaultValue, converter};
    }

    getAllSettings() {
        return this.settings;
    }

    async setCommand(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "set <setting> <value>",
            arguments: [
                {
                    type: "string",
                    required: true
                },
                {
                    type: "string",
                    required: true,
                    greedy: true
                }
            ],
            permission: "settings.set"
        });
        if (args === null) return;
        let [key, value] = args;

        msg.getChannel().getSettings().set(key, value)
            .then(() => msg.reply(__("settings.set.successful", key, value)))
            .catch(e => {
                msg.reply(__("settings.set.failed", key));
                Application.getLogger().error("Unable to set setting", {cause: e});
            });
    }

    async unsetCommand(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "unset <setting>",
            arguments: [
                {
                    type: "string",
                    required: true
                }
            ],
            permission: "settings.reset"
        });
        if (args === null) return;
        let key = args[0];
        msg.getChannel().getSettings().unset(key)
            .then(() => msg.reply(__("settings.unset.successful", key)))
            .catch(e => {
                msg.reply(__("settings.unset.failed", key));
                Application.getLogger().error("Unable to unset setting", {cause: e});
            });
    }

    async resetCommand(event: CommandEvent) {
        let msg = event.getMessage();
        let args = await event.validate({
            usage: "reset-settings",
            permission: "settings.reset.all"
        });
        if (args === null) return;

        let confirmation = await ConfirmationModule.make(msg, __("settings.reset.confirmation"), 30);
        confirmation.addListener(ConfirmedEvent, () => {
            msg.getChannel().getSettings().reset()
                .then(() => msg.reply(__("settings.reset.successful")))
                .catch((e) => {
                    msg.reply(__("settings.reset.failed"));
                    Application.getLogger().error("Unable to reset the channel's settings", {cause: e});
                });
        });
        confirmation.run();
    }
}