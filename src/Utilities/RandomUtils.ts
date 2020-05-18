import {array_rand} from "./ArrayUtils";

export function generateRandomCode(length: number): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");

    for (let i = 0; i < length; i++) text += array_rand(possible);

    return text;
}

export function randomInt(min: number, max?: number): number {
    return Math.floor(randomFloat(min, max));
}

export function randomFloat(min: number, max?: number): number {
    if (!max) {
        max = min;
        min = 0;
    }

    return (Math.random() * (max - min)) + min;
}

export function randomChance(chance: number) {
    return Math.random() <= chance;
}