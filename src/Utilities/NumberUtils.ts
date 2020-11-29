export function appendOrdinal(num: number): string {
    const suffixes = ["th", "st", "nd", "rd"];
    const value = num % 100;
    return num + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
}