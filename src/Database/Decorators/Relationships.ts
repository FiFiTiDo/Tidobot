import {where} from "../Where";
import Entity, {EntityConstructor} from "../Entities/Entity";
import {getOrSetProp} from "../../Utilities/functions";
import {addMetadata, getMetadata} from "../../Utilities/DecoratorUtils";
import {objectHasProperty} from "../../Utilities/ObjectUtils";

const RELATIONSHIP_KEY = "entity:relationship";

export function getRelationships<T extends Entity<T>>(entity: Entity<T>): (string | symbol)[] {
    return getMetadata<(string | symbol)[]>(RELATIONSHIP_KEY, entity) || [];
}

type Descriptor<T> = TypedPropertyDescriptor<() => Promise<T | null>>;
type DescriptorMany<T> = TypedPropertyDescriptor<() => Promise<T[]>>;

export function OneToOne<T extends Entity<T>>(entity: EntityConstructor<T>, localKey: string, foreignKey: string): Function {
    return function <T2>(obj: T2, key: string, descriptor: Descriptor<T>): Descriptor<T> {
        addMetadata(RELATIONSHIP_KEY, obj, key);
        descriptor.value = async function (): Promise<T | null> {
            return getOrSetProp(this, key, () => entity.retrieve({channel: this.getChannel()}, where().eq(foreignKey, this[localKey])));
        };
        return descriptor;
    };
}

export function ManyToOne<T extends Entity<T>>(entity: EntityConstructor<T>, localKey: string, foreignKey: string): Function {
    return function <T2>(obj: T2, key: string, descriptor: DescriptorMany<T>): DescriptorMany<T> {
        addMetadata(RELATIONSHIP_KEY, obj, key);
        descriptor.value = async function (): Promise<T[]> {
            return getOrSetProp(this, key, () => entity.retrieveAll({channel: this.getChannel()}, where().eq(foreignKey, this[localKey])));
        };
        return descriptor;
    };
}

export function OneToMany<T extends Entity<T>>(entity: EntityConstructor<T>, localKey: string, foreignKey: string): Function {
    return function <T2>(obj: T2, key: string, descriptor: DescriptorMany<T>): DescriptorMany<T> {
        addMetadata(RELATIONSHIP_KEY, obj, key);
        descriptor.value = async function (): Promise<T[]> {
            return getOrSetProp(this, key, () => entity.retrieveAll({channel: this.getChannel()}, where().eq(foreignKey, this[localKey])));
        };
        return descriptor;
    };
}

export function ManyToMany<foreignT extends Entity<foreignT>, joiningT extends Entity<joiningT>>(
    foreignEntity: EntityConstructor<foreignT>, joiningEntity: EntityConstructor<joiningT>,
    localKey: string, localJoinKey: string, foreignKey: string, foreignJoinKey: string
): Function {
    return function <T>(obj: T, key: string, descriptor: DescriptorMany<foreignT>): DescriptorMany<foreignT> {
        addMetadata(RELATIONSHIP_KEY, obj, key);

        descriptor.value = async function (): Promise<foreignT[]> {
            return getOrSetProp(this, key, async () => {
                const joins = await joiningEntity.retrieveAll({channel: this.getChannel()}, where().eq(localJoinKey, this[localKey]));
                const ops = [];
                for (const join of joins)
                    ops.push(foreignEntity.retrieve({channel: this.getChannel()}, where().eq(foreignKey, join[foreignJoinKey])));
                return await Promise.all(ops);
            });
        };

        return descriptor;
    };
}

export function ImportModel<T extends Entity<T>>(entityConstructor: EntityConstructor<T>): Function {
    return function <T2>(obj: T2, key: string, descriptor: DescriptorMany<T>): DescriptorMany<T> {
        if (!(obj instanceof Entity)) throw new Error("Model needs the service to retrieve the data.");
        descriptor.value = async function (): Promise<T[]> {
            if (!objectHasProperty(this, "getChannel")) {
                return entityConstructor.retrieveAll({channel: this});
            } else {
                return entityConstructor.retrieveAll({channel: this.getChannel()});
            }
        };
        return descriptor;
    };
}