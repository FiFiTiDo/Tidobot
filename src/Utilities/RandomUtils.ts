import {arrayRand} from "./ArrayUtils";

export function generateRandomCode(length: number): string {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");

    for (let i = 0; i < length; i++) text += arrayRand(possible);

    return text;
}

export function randomInt(min: number, max?: number): number {
    return Math.floor(randomFloat(min, max));
}

export function randomFloat(min?: number, max?: number): number {
    if (typeof min === "undefined" && typeof max === "undefined")
        return Math.random();
    else if (typeof min === "number" && typeof max === "undefined") {
        max = min;
        min = 0;
    }

    return (Math.random() * (max - min)) + min;
}

export function randomChance(chance: number) {
    return Math.random() <= chance;
}