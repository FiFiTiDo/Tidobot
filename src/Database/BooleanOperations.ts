import {PreparedColumn, PreparedData} from "./PreparedData";
import {AbstractQuery} from "./QueryBuilder";

type BooleanCallback<T extends AbstractQuery> = (where: Where<T>) => void;

abstract class BooleanOperation {
    abstract toString(): string;
    abstract getPreparedData(): PreparedData;
}

class BinaryOperation extends BooleanOperation {
    constructor(private readonly sep: string, private readonly data: BooleanOperation[]) {
        super();
    }

    toString(): string {
        if (this.data.length === 1) return this.data[0].toString();
        return "(" + this.data.map(data => data.toString()).join(` ${this.sep} `) + ")";
    }

    getPreparedData(): PreparedData {
        return this.data.reduce<PreparedData>((prev, curr) => prev.concat(curr.getPreparedData()), []);
    }
}

class AndExpression extends BinaryOperation {
    constructor(data: BooleanOperation[]) {
        super("AND", data);
    }
}

class OrExpression extends BinaryOperation {
    constructor(data: BooleanOperation[]) {
        super("OR", data);
    }
}

class InExpression extends BooleanOperation {
    constructor(private readonly column: string, private possible: any[]) {
        super();
    }

    toString(): string {
        return `${this.column} IN ${this.possible.join(',')}`;
    }

    getPreparedData(): PreparedData {
        return [];
    }
}

class NotInExpression extends BooleanOperation {
    constructor(private readonly column: string, private possible: any[]) {
        super();
    }

    toString(): string {
        return `${this.column} NOT IN ${this.possible.join(',')}`;
    }

    getPreparedData(): PreparedData {
        return [];
    }
}

class EqualsExpression extends BooleanOperation {
    constructor(private readonly data: PreparedColumn) {
        super();
    }

    toString(): string {
        return `${this.data.column} = ${this.data.key}`;
    }

    getPreparedData(): PreparedData {
        return [this.data];
    }
}

export class Where<T extends AbstractQuery> {
    private readonly data: BooleanOperation[];
    private readonly preparedValues: { [key: string]: any };
    private readonly reservedKeys: string[];

    constructor(private parent: Where<T> = null, private query: T = null) {
        this.data = [];
        this.preparedValues = {};
        this.reservedKeys = [];
    }

    addPreparedValue(column: string, value: any): PreparedColumn {
        if (this.parent !== null) return this.parent.addPreparedValue(column, value);

        let base_key = "$" + column;
        let key = base_key;
        let i = 0;
        while (this.isKeyReserved(key)) {
            key = base_key + (++i);
        }
        this.preparedValues[key] = value;
        this.addReservedKey(key);

        return { key, column, value };
    }

    getPreparedValues(): { [key: string]: any } {
        return this.preparedValues;
    }

    addReservedKey(key: string) {
        this.reservedKeys.push(key);
    }

    isKeyReserved(key: string) {
        return this.reservedKeys.indexOf(key) >= 0;
    }

    and(func: BooleanCallback<T>): this {
        let where = new Where(this, null);
        func.call(null, where);
        this.add(new AndExpression(where.getData()));
        return this;
    }

    or(func: BooleanCallback<T>): this {
        let where = new Where(this, null);
        func.call(null, where);
        this.add(new OrExpression(where.getData()));
        return this;
    }

    eq(column: string, value: any): this {
        this.add(new EqualsExpression(this.addPreparedValue(column, value)));
        return this;
    }

    in(column: string, possible: any[]): this {
        this.add(new InExpression(column, possible));
        return this;
    }

    notIn(column: string, possible: any[]): this {
        this.add(new NotInExpression(column, possible));
        return this;
    }

    add(op: BooleanOperation): this {
        this.data.push(op);
        return this;
    }

    addAll(ops: BooleanOperation[]): this {
        ops.forEach(this.add);
        return this;
    }

    toString(): string {
        if (this.data.length < 1) return "";
        return " WHERE " + new AndExpression(this.data).toString();
    }

    getData(): BooleanOperation[] {
        return this.data;
    }

    done() {
        return this.query;
    }
}

export function where() {
    return new Where(null, null);
}
