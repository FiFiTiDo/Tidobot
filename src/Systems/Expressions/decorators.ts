import {addMetadata, getMetadata} from "../../Utilities/DecoratorUtils";
import AbstractModule, {ModuleConstructor} from "../../Modules/AbstractModule";
import {ExpressionContextResolver as ResolverFunc} from "./ExpressionSystem";

const RESOLVER_META_KEY = "expression:context-resolvers";

export function getResolvers<T extends AbstractModule>(moduleConstructor: ModuleConstructor<T>): (string | symbol)[] {
    return getMetadata<(string | symbol)[]>(RESOLVER_META_KEY, moduleConstructor) || [];
}

export function ExpressionContextResolver(target: any, property: string | symbol, descriptor: TypedPropertyDescriptor<ResolverFunc>): void {
    addMetadata(RESOLVER_META_KEY, target.constructor, property);
}