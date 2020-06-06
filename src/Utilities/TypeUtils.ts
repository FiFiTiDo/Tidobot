export type ConstructorOf<T extends object> = {
    new(...args: any): T;
}
