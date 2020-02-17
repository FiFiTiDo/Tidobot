export interface Deserializer<T extends Serializable> {
    deserialize(input: string): T;
}

export interface Serializable {
    serialize(): string;
}