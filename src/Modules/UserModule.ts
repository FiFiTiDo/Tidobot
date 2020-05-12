import AbstractModule from "./AbstractModule";
import UserPermissionsEntity from "../Database/Entities/UserPermissionsEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import Logger from "../Utilities/Logger";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {NewChannelEvent, NewChannelEventArgs} from "../Chat/Events/NewChannelEvent";
import {inject} from "inversify";
import symbols from "../symbols";
import Command from "../Systems/Commands/Command";
import {CommandEventArgs} from "../Systems/Commands/CommandEvent";
import CommandSystem from "../Systems/Commands/CommandSystem";

class UserCommand extends Command {
    constructor(private confirmationFactory: ConfirmationFactory) {
        super("user", "<grant|deny|reset>", ["u"]);

        this.addSubcommand("grant", this.grant);
        this.addSubcommand("deny", this.deny);
        this.addSubcommand("reset", this.reset);
    }

    async grant({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "user grant <group> <permission>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                },
                {
                    value: {
                        type: "string",
                    },
                    required: true
                }
            ],
            permission: "permission.grant"
        });
        if (args === null) return;
        const [user, permission] = args as [ChatterEntity, string];

        await UserPermissionsEntity.update(user, permission, true, msg.getChannel())
            .then(() => response.message("user:permission.granted", {permission, username: user.name}))
            .catch(e => {
                response.genericError();
                Logger.get().error("Unable to grant permission to user", {cause: e});
            });
    }

    async deny({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "user deny <group> <permission>",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                },
                {
                    value: {
                        type: "string",
                    },
                    required: true
                }
            ],
            permission: "permission.deny"
        });
        if (args === null) return;
        const [user, permission] = args as [ChatterEntity, string];

        await UserPermissionsEntity.update(user, permission, false, msg.getChannel())
            .then(() => response.message("user:permission.denied", {username: user.name, permission}))
            .catch(e => {
                response.genericError();
                Logger.get().error("Unable to deny permission for user", {cause: e});
            });
    }

    async reset({event, message: msg, response}: CommandEventArgs): Promise<void> {
        const args = await event.validate({
            usage: "group reset <group> [permission]",
            arguments: [
                {
                    value: {
                        type: "chatter",
                    },
                    required: true
                },
                {
                    value: {
                        type: "string",
                    },
                    required: false
                }
            ],
            permission: "permission.reset"
        });
        if (args === null) return;
        const [user, permission] = args as [ChatterEntity, string | undefined];

        if (permission) {
            await UserPermissionsEntity.delete(user, permission)
                .then(() => response.message("user:permission.delete.specific", {username: user.name, permission}))
                .catch(e => {
                    response.genericError();
                    Logger.get().error("Unable to deny permission for user", {cause: e});
                });
        } else {
            const confirmation = await this.confirmationFactory(msg, await response.translate("user:permission.delete.confirm", {username: user.name}), 30);
            confirmation.addListener(ConfirmedEvent, () => {
                return UserPermissionsEntity.clear(user)
                    .then(() => response.message("user:permission.delete.all", {username: user.name}))
                    .catch(e => {
                        response.genericError();
                        Logger.get().error("Unable to deny permission for user", {cause: e});
                    });
            });
            confirmation.run();
        }
    }
}

@HandlesEvents()
export default class UserModule extends AbstractModule {
    constructor(@inject(symbols.ConfirmationFactory) private makeConfirmation: ConfirmationFactory) {
        super(UserModule.name);

        this.coreModule = true;
    }

    initialize(): void {
        const cmd = CommandSystem.getInstance();
        cmd.registerCommand(new UserCommand(this.makeConfirmation), this);
    }

    @EventHandler(NewChannelEvent)
    async onNewChannel({channel}: NewChannelEventArgs): Promise<void> {
        await ChatterEntity.createTable({channel});
        await UserPermissionsEntity.createTable({channel});
    }
}