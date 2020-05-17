import Entity from "./Entities/Entity";
import {Resolvable, resolve} from "../Utilities/Interfaces/Resolvable";

export default class EntityStateList<TEntity extends Entity<TEntity>, TValue> {
    private state: { [key: number]: TValue } = {};
    private entityMap: { [key: number]: TEntity } = {};

    constructor(private defVal: Resolvable<TEntity, TValue>) {
    }

    public has(entity: TEntity): boolean {
        return Object.prototype.hasOwnProperty.call(this.state, entity.id);
    }

    public async get(entity: TEntity): Promise<TValue> {
        if (!this.has(entity)) this.set(entity, await resolve(this.defVal));
        return this.state[entity.id];
    }

    public set(entity: TEntity, value: TValue): void {
        this.state[entity.id] = value;
        this.entityMap[entity.id] = entity;
    }

    public delete(entity: TEntity) {
        delete this.state[entity.id];
        delete this.entityMap[entity.id];
    }

    public entities(): TEntity[] {
        return Object.values(this.entityMap);
    }

    public values(): TValue[] {
        return Object.values(this.state);
    }

    public entries(): [TEntity, TValue][] {
        return Object.entries(this.state).map(([id, value]) => [this.entityMap[id], value]);
    }

    public clear(): void {
        this.state = {};
    }
}