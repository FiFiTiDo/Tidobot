import User from "./User";
import Channel, {ChannelStateList} from "./Channel";
import Application from "../Application/Application";
import {Serializable} from "../Utilities/Serializable";
import {Group} from "../Modules/GroupsModule";

export default class Chatter extends User implements Serializable {
    private readonly channel: Channel;
    private banned: boolean;
    private regular: boolean;
    private balance: number;

    constructor(id: string, name: string, channel: Channel) {
        super(id, name);

        this.channel = channel;
        this.banned = false;
        this.regular = false;
        this.balance = 0.0;
    }

    static fromRow(row, user: User, channel: Channel): Chatter {
        let chatter = new Chatter(user.getId(), user.getName(), channel);
        chatter.ignore = user.isIgnored();
        chatter.banned = row.banned;
        chatter.regular = row.regular;
        chatter.balance = row.balance;
        chatter.normalize();
        return chatter;
    }

    static async getAll(channel: Channel) {
        let rows = await channel.query("users").select().all();

        let chatters = [];
        for (let row of rows) {
            let user = new User(row.id, null);
            await user.load();
            chatters.push(this.fromRow(row, user, channel));
        }
        return chatters;
    }

    static async find(name: string, channel: Channel): Promise<Chatter> {
        let user = await User.findByName(name);
        if (user === null) return null;

        let row = await channel.query("users").select().where().eq("name", name).done().first();
        if (row === null) return null;

        return this.fromRow(row, user, channel);
    }

    static deserialize(input: string) {
        let {id, name, channel, ignore, banned, regular, balance} = JSON.parse(input);
        channel = Channel.deserialize(channel);
        let chatter = new Chatter(id, name, channel);
        chatter.ignore = ignore;
        chatter.banned = banned;
        chatter.regular = regular;
        chatter.balance = balance;
        chatter.normalize();
        return chatter;
    }

    isBanned() {
        return this.banned;
    }

    async setBanned(value: boolean) {
        this.banned = value;
        await this.save();
    }

    isRegular() {
        return this.regular;
    }

    async setRegular(value: boolean) {
        this.regular = value;
        await this.save();
    }

    getBalance() {
        return this.balance;
    }

    async setBalance(newBalance: number) {
        this.balance = newBalance;
        await this.save();
    }

    async deposit(amount: number) {
        this.balance += amount;
        await this.save();
    }

    async withdraw(amount: number) {
        this.balance -= amount;
        await this.save();
    }

    tempban(length: number, reason: string = "Automatic temporary ban by Tidobot") {
        return Application.getAdapter().tempbanChatter(this, length, reason);
    }

    ban(reason: string = "The ban hammer has spoken!") {
        return Application.getAdapter().banChatter(this, reason);
    }

    unban() {
        return Application.getAdapter().unbanChatter(this);
    }

    async getGroups(): Promise<Group[]> {
        return this.getChannel().query("groupMembers")
            .select().where().eq("user_id", this.getId()).done().all()
            .then(rows => rows.map(row => Group.fromRow(row, this.getChannel())));
    }

    async hasPermission(permission: string): Promise<boolean> {
        let row = await this.getChannel().query("userPermissions")
            .select().where().eq("user_id", this.getId()).eq("permission", permission).done().first();
        if (row !== null) {
            return row.allowed;
        }

        for (let group of await this.getGroups())
            if (await group.hasPermission(permission))
                return true;

        return false;
    }

    getChannel() {
        return this.channel;
    }

    is(chatter: Chatter) {
        return this.getId() === chatter.getId() && this.getChannel().getId() === chatter.getChannel().getId();
    }

    async exists(): Promise<boolean> {
        try {
            let count = await this.channel.query("users")
                .count()
                .where().eq("id", this.getId()).done()
                .exec();
            return count > 0;
        } catch (e) {
            Application.getLogger().error("Unable to verify the existence of the user in the database", {cause: e});
            return false;
        }
    }

    async save(): Promise<void> {
        await super.save();
        await this.channel.query("users")
            .insert({
                id: this.getId(),
                name: this.getName(),
                banned: this.banned,
                regular: this.regular,
                balance: this.balance
            }).or("REPLACE").exec();
    }

    async load(): Promise<void> {
        await super.load();
        let row = await this.channel.query("users")
            .select("*")
            .where().eq("name", this.getName()).done()
            .first();
        if (row === null) return;

        this.banned = row.banned;
        this.regular = row.regular;
        this.balance = row.balance;
        this.normalize();
    }

    private normalize() {
        if (typeof this.banned === "undefined") this.banned = false;
        if (typeof this.regular === "undefined") this.regular = false;
        if (typeof this.balance === "undefined") this.balance = 0.0;
    }

    serialize(): string {
        return JSON.stringify({
            id: this.getId(),
            name: this.getName(),
            channel: this.channel.serialize(),
            ignore: this.isIgnored(),
            banned: this.banned,
            regular: this.regular,
            balance: this.balance
        })
    }
}

export class ChatterStateList<T> {
    private readonly list: ChannelStateList<{ [key: string]: T }>;
    private readonly defVal: T;

    constructor(defVal: T) {
        this.list = new ChannelStateList({});
        this.defVal = defVal;
    }

    hasChatter(chatter: Chatter) {
        return this.list.getChannel(chatter.getChannel()).hasOwnProperty(chatter.getId());
    }

    getChatter(chatter: Chatter): T {
        if (!this.hasChatter(chatter))
            this.list.getChannel(chatter.getChannel())[chatter.getId()] = this.defVal;

        return this.list.getChannel(chatter.getChannel())[chatter.getId()];
    }

    setChatter(chatter: Chatter, value: T) {
        this.list.getChannel(chatter.getChannel())[chatter.getId()] = value;
    }

    removeChatter(chatter: Chatter) {
        let list = this.list.getChannel(chatter.getChannel());
        delete list[chatter.getId()];
    }
}
