import Database from "./Database";
import Channel from "../Chat/Channel";
import {TableBuilder, TableBuilderCallback} from "./Table";

export default class ChannelSchemaBuilder {
    constructor(private db: Database, private channel: Channel) {}

    addTable(table: string, cb: TableBuilderCallback) {
        let name = this.getTableName(table);
        let builder = new TableBuilder();
        cb(builder);
        this.db.schema.set(name, builder.build(name));
    }

    getTableName(table: string) {
        return this.channel.getName() + "_" + table;
    }
}