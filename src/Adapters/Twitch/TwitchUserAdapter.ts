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

    getUser(param: string | tmi.Userstate): Promise<User> {
        if (typeof param === "string") {
            return this.findByName(param).then(optional => optional.orElseAsync(async () => {
                try {
                    const resp = await this.api.getUsers({ login: name });
                    return await this.createUser(name, resp.data[0].id);
                } catch (e) {
                    logError(TwitchAdapter.LOGGER, e, "Unable to create new user", true);
                    process.exit(1);
                }
            }));
        } else {
            return this.findById(param["user-id"]).then(optional => optional.orElseAsync(() => {
                return this.createUser(param["login"], param["user-id"]);
            }));
        }
    }
}