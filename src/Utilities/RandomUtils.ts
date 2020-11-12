import _ from "lodash";

export function generateRandomCode(length: number): string {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
    return _.sampleSize(possible, length).join("");
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

export function randomInt(min: number, max?: number): number {
    return Math.floor(randomFloat(min, max));
}

export function randomChance(chance: number): boolean {
    return Math.random() <= chance;
}