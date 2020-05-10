export function getEnumNames(e: object) {
    return Object.keys(e).map(key => e[key]).filter(val => typeof val === 'string');
}