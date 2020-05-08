import AbstractModule from "./AbstractModule";
import UserPermissionsEntity from "../Database/Entities/UserPermissionsEntity";
import ChatterEntity from "../Database/Entities/ChatterEntity";
import {ConfirmationFactory, ConfirmedEvent} from "./ConfirmationModule";
import {Key} from "../Utilities/Translator";
import Logger from "../Utilities/Logger";
import {EventHandler, HandlesEvents} from "../Systems/Event/decorators";
import {NewChannelEvent} from "../Chat/NewChannelEvent";
import {inject, injectable} from "inversify";
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
        const [user, permStr] = args as [ChatterEntity, string];

        await UserPermissionsEntity.update(user, permStr, true, msg.getChannel())
            .then(() => response.message(Key("users.permission.granted.successful"), permStr, user.name))
            .catch(e => {
                response.message(Key("users.permission.granted.failed"), permStr, user.name);
                Logger.get().error("Unable to grant permission to user", { cause: e });
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
        const [user, permStr] = args as [ChatterEntity, string];

        await UserPermissionsEntity.update(user, permStr, false, msg.getChannel())
            .then(() => response.message(Key("users.permission.denied.successful"), user.name, permStr))
            .catch(e => {
                response.message(Key("users.permission.denied.failed"), user.name, permStr);
                Logger.get().error("Unable to deny permission for user", { cause: e });
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
        const [user, permStr] = args as [ChatterEntity, string|undefined];

        if (permStr) {
            await UserPermissionsEntity.delete(user, permStr)
                .then(() => response.message(Key("users.permission.deleted.specific.successful"), user.name, permStr))
                .catch(e => {
                    response.message(Key("users.permission.deleted.specific.failed"), user.name, permStr);
                    Logger.get().error("Unable to deny permission for user", { cause: e });
                });
        } else {
            const confirmation = await this.confirmationFactory(msg, response.translate(Key("users.permission.deleted.all.confirm")), 30);
            confirmation.addListener(ConfirmedEvent, () => {
                return UserPermissionsEntity.clear(user)
                    .then(() => response.message(Key("users.permission.deleted.all.failed.successful"), user.name, permStr))
                    .catch(e => {
                        response.message(Key("users.permission.deleted.all.failed"), user.name, permStr);
                        Logger.get().error("Unable to deny permission for user", { cause: e });
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
    async onNewChannel({ channel }: NewChannelEvent.Arguments): Promise<void> {
        await UserPermissionsEntity.createTable({ channel });
    }
}