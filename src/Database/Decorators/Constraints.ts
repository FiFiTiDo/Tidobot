import Entity, {EntityConstructor} from "../Entities/Entity";
import {addMetadata, getMetadata} from "../../Utilities/DeccoratorUtils";

const CONSTRAINTS_KEY = "entity:constraints";

interface Constraint {
    name: string;
    sql: string;
}

export function getConstraints<T extends Entity<T>>(entity: T | EntityConstructor<T>): Constraint[] {
    return getMetadata<Constraint[]>(CONSTRAINTS_KEY, entity) || [];
}

export function formatConstraints<T extends Entity<T>>(entity: T | EntityConstructor<T>): string[] {
    return getConstraints(entity).map(({name, sql}) => `CONSTRAINT ${name} ${sql}`);
}

export function Unique(name: string, columns: string | string[]): Function {
    return function <T>(target: T): T {
        if (!Array.isArray(columns)) columns = [columns];
        addMetadata<Constraint>(CONSTRAINTS_KEY, target, {name, sql: `UNIQUE (${columns.join(", ")})`});
        return target;
    };
}

export function ForeignKey(name: string, key: string, foreignTable: string, foreignKey: string): Function {
    return function <T>(target: T): T {
        addMetadata<Constraint>(CONSTRAINTS_KEY, target, {
            name,
            sql: `FOREIGN KEY (${key}) REFERENCES ${foreignTable}(${foreignKey})`
        });
        return target;
    };
}

export function NotNull(name: string, key: string): Function {
    return function <T>(target: T): T {
        addMetadata<Constraint>(CONSTRAINTS_KEY, target, {name, sql: `NOT NULL (${key})`});
        return target;
    };
}

export function PrimaryKey(name: string, key: string): Function {
    return function <T>(target: T): T {
        addMetadata<Constraint>(CONSTRAINTS_KEY, target, {name, sql: `PRIMARY KEY (${key})`});
        return target;
    };
}

export function Check(name: string, condition: string): Function {
    return function <T>(target: T): T {
        addMetadata<Constraint>(CONSTRAINTS_KEY, target, {name, sql: `CHECK (${condition})`});
        return target;
    };
}