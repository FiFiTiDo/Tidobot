import Entity, {EntityConstructor} from "../Entities/Entity";

interface Constraint {
    name: string,
    sql: string
}

const constraints_map: Map<string, Constraint[]> = new Map();
function addConstraint(entity: Entity, name: string, sql: string): void {
    let arr = getConstraints(entity);
    arr.push({ name, sql });
    constraints_map.set(entity.constructor.name, arr);
}

export function getConstraints(entity: Entity|EntityConstructor<any>) {
    return constraints_map.get(entity instanceof Entity ? entity.constructor.name : entity.name) || [];
}

export function formatConstraints(entity: Entity|EntityConstructor<any>) {
    return getConstraints(entity).map(({name, sql}) => `CONSTRAINT ${name} ${sql}`);
}

export function Unique(name: string, columns: string|string[]) {
    return function (target: any) {
        if (!Array.isArray(columns)) columns = [columns];
        addConstraint(target, name, `UNIQUE (${columns.join(", ")})`);
        return target;
    }
}

export function ForeignKey(name: string, key: string, foreign_table: string, foreign_key: string) {
    return function (target: any) {
        addConstraint(target, name, `FOREIGN KEY (${key}) REFERENCES ${foreign_table}(${foreign_key})`);
        return target;
    }
}

export function NotNull(name: string, key: string) {
    return function (target: any) {
        addConstraint(target, name, `NOT NULL (${key})`);
        return target;
    }
}

export function PrimaryKey(name: string, key: string) {
    return function (target: any) {
        addConstraint(target, name, `PRIMARY KEY (${key})`);
        return target;
    }
}

export function Check(name: string, condition) {
    return function (target: any) {
        addConstraint(target, name, `CHECK (${condition})`);
        return target;
    }
}