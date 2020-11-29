export function removePrefix(needle: string, haystack: string): { newString: string; removed: boolean } {
    return haystack.toLowerCase().startsWith(needle.toLowerCase()) ? {
        newString: haystack.substring(needle.length + 1),
        removed: true
    } : {
        newString: haystack,
        removed: false
    };
}