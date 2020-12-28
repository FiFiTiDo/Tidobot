import { UserAdapter } from "../UserAdapter";
import * as tmi from "tmi.js";
import { Service } from "typedi";
import { User } from "../../Database/Entities/User";
import { helix } from "./TwitchApi";
import TwitchAdapter from "./TwitchAdapter";
import { logError } from "../../Utilities/Logger";

@Service()
export class TwitchUserAdapter extends UserAdapter<string|tmi.Userstate> {
    constructor(private readonly api: helix.Api) {
        super();
    }

    async getUser(param: string | tmi.Userstate): Promise<User> {
        if (typeof param === "string") {
            const optional = await this.findByName(param);
            return await optional.orElseAsync(async () => {
                try {
                    const resp = await this.api.getUsers({ login: param });
                    const { id, login: name } = resp.data[0];
                    return await this.createUser(name, id);
                } catch (e) {
                    logError(TwitchAdapter.LOGGER, e, "Unable to create new user", true);
                    process.exit(1);
                }
            });
        } else {
            const optional_1 = await this.findById(param["user-id"]);
            return await optional_1.orElseAsync(() => {
                return this.createUser(param["login"], param["user-id"]);
            });
        }
    }

    getUserByName(name: string): Promise<User> {
        return this.getUser(name);
    }

    async getUserByNativeId(nativeId: string): Promise<User> {
        const optional = await this.findById(nativeId);
        return await optional.orElseAsync(async () => {
            try {
                const resp = await this.api.getUsers({ id: nativeId });
                const { id, login: name } = resp.data[0];
                return await this.createUser(name, id);
            } catch (e) {
                logError(TwitchAdapter.LOGGER, e, "Unable to create new user", true);
                process.exit(1);
            }
        });
    }
}