enum State {
    TEXT, BLANK_SPACE, ESCAPED, IN_STRING, START_ESCAPE, IN_ESCAPE
}

export default class MessageParser {
    static parse(input: string): string[] {
        const parts: string[] = [];
        let state: State = State.TEXT;
        let prevState: State = state; // Necessary for State.ESCAPED to know which state to return to
        let part = "";

        for (const char of input) {
            if (state === State.TEXT || state === State.BLANK_SPACE) {
                if (char === "$") { // Start of escape sequence
                    prevState = state;
                    state = State.START_ESCAPE;
                    continue;
                } else if (char === "\"") { // Start of string
                    prevState = state;
                    state = State.IN_STRING;
                    continue;
                } else if (char === "\\") { // Next character is escaped
                    prevState = state;
                    state = State.ESCAPED;
                    continue;
                }
            }

            if (state === State.TEXT) { // Normal text, part of argument
                if (this.isBlank(char)) { // Blank space
                    prevState = state;
                    state = State.BLANK_SPACE;
                    if (part.length > 0) // Add part if not empty
                        parts.push(part);
                    part = "";
                } else { // Add character to current part
                    part += char;
                }
            } else if (state === State.BLANK_SPACE) { // Blank space
                if (!this.isBlank(char)) { // Not blank, go back to text
                    prevState = state;
                    state = State.TEXT;
                    part += char;
                }
                // Ignore blank characters (space, tab, etc.)
            } else if (state === State.ESCAPED) { // Character escaped, just add to current part
                state = prevState;
                prevState = State.ESCAPED;
                part += char;
            } else if (state === State.IN_STRING) {
                if (char === "\"") { // End of string, add part
                    prevState = state;
                    state = State.TEXT;
                    parts.push(part);
                    part = "";
                } else if (char === "\\") { // Next character is escaped
                    prevState = state;
                    state = State.ESCAPED;
                } else { // Add other characters to part
                    part += char;
                }
            } else if (state === State.START_ESCAPE) { // Start of escape sequence
                if (char === "{") { // Escape sequence started
                    prevState = state;
                    state = State.IN_ESCAPE;
                } else if (this.isBlank(char)) { // Failed to start escape sequence, interrupted by blank space
                    prevState = state;
                    state = State.BLANK_SPACE;
                    part += "$";
                    parts.push(part);
                    part = "";
                } else if (char === "\\") { // Failed to start escape sequence, interrupted by escape character
                    state = State.ESCAPED;
                    part += "$";
                } else { // Failed to start escape sequence, interrupted by other character
                    prevState = state;
                    state = State.TEXT;
                    part += "$" + char;
                }
            } else if (state === State.IN_ESCAPE) { // In escape sequence
                if (char === "}") { // End of escape sequence so add part
                    prevState = state;
                    state = State.TEXT;
                    parts.push(`\${${part}}`);
                    part = "";
                } else if (char === "\\") { // Escape character
                    prevState = state;
                    state = State.ESCAPED;
                } else { // Add other characters to part
                    part += char;
                }
            }
        }

        if (part.length > 0) parts.push(part);

        return parts;
    }

    private static isBlank(char: string) {
        return char.trim().length < 1;
    }
}