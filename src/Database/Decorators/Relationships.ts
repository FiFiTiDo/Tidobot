import {where} from "../BooleanOperations";
import Entity, {EntityConstructor} from "../Entities/Entity";
import {getOrSetProp} from "../../Utilities/functions";

const relationships_map: Map<string, (string|symbol)[]> = new Map();
function addRelationship(model: string, key: string|symbol) {
    let relationships = getRelationships(model);
    relationships.push(key);
    relationships_map.set(model, relationships);
}

export function getRelationships(model_name: string) {
    return relationships_map.get(model_name) || [];
}

export function OneToOne<T extends Entity>(entity_const: EntityConstructor<T>, localKey: string, foreignKey: string): any {
    return function (obj: Object, key: string, descriptor: TypedPropertyDescriptor<() => Promise<T|null>>): any {
        addRelationship(obj.constructor.name, key);
        descriptor.value = async function () {
            return getOrSetProp(this, key, () => Entity.retrieve(entity_const, this.getService(), this.getChannel(), where().eq(foreignKey, this[localKey])));
        };
        return descriptor;
    }
}

export function ManyToOne<T extends Entity>(entity_const: EntityConstructor<T>, localKey: string, foreignKey: string): any {
    return function (obj: Object, key: string, descriptor: TypedPropertyDescriptor<() => Promise<T[]>>): any {
        addRelationship(obj.constructor.name, key);
        descriptor.value = async function () {
            return getOrSetProp(this, key, () => Entity.retrieveAll(entity_const, this.getService(), this.getChannel(), where().eq(foreignKey, this[localKey])));
        };
        return descriptor;
    }
}

export function OneToMany<T extends Entity>(entity_const: EntityConstructor<T>, localKey: string, foreignKey: string): any {
    return function (obj: Object, key: string, descriptor: TypedPropertyDescriptor<() => Promise<T[]>>): any {
        addRelationship(obj.constructor.name, key);
        descriptor.value = async function () {
            return getOrSetProp(this, key, () => Entity.retrieveAll(entity_const, this.getService(), this.getChannel(), where().eq(foreignKey, this[localKey])));
        };
        return descriptor;
    }
}

export function ManyToMany<T1 extends Entity, T2 extends Entity>(foreign_model: EntityConstructor<T1>, joining_model: EntityConstructor<T2>, localKey: string, localJoinKey: string, foreignKey: string, foreignJoinKey: string): any {
    return function (obj: Object, key: string, descriptor: TypedPropertyDescriptor<() => Promise<T1[]>>): any {
        addRelationship(obj.constructor.name, key);

        descriptor.value = async function () {
            return getOrSetProp(this, key, async () => {
                let joins = await Entity.retrieveAll(joining_model, this.getService(), this.getChannel(), where().eq(localJoinKey, this[localKey]));
                let ops = [];
                for (let join of joins)
                    ops.push(Entity.retrieve(foreign_model, this.getService(), this.getChannel(), where().eq(foreignKey, join[foreignJoinKey])));
                return await Promise.all(ops);
            });
        };
        return descriptor;
    }
}

export function ImportModel<T extends Entity>(model_const: EntityConstructor<T>): any {
    return function (obj: Object, key: string|symbol, descriptor: TypedPropertyDescriptor<() => Promise<T[]>>): any {
        if (!(obj instanceof Entity)) throw new Error("Model needs the service to retrieve the data.");
        descriptor.value = async () => Entity.retrieveAll(model_const, obj.getService(), obj.getChannelName());
        return descriptor;
    }
}