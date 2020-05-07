import Database from "./Database";
import {TableBuilder, TableBuilderCallback} from "./Table";
import ChannelEntity from "./Entities/ChannelEntity";

export default class ChannelSchemaBuilder {
    constructor(private db: Database, private channel: ChannelEntity) {}

    addTable(table: string, cb: TableBuilderCallback): void {
        const name = this.getTableName(table);
        const builder = new TableBuilder();
        cb(builder);
        this.db.schema.set(name, builder.build(name));
    }

    getTableName(table: string): string {
        return this.channel.name + "_" + table;
    }
}