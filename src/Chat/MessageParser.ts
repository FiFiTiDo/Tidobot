export default class MessageParser {
    static parse(input: string): string[] {
        const parts = [];
        let i = 0;
        let escapeSeq = false;
        let part = "";

        while (i < input.length) {
            const last = input.charAt(i - 1);
            const curr = input.charAt(i);
            const next = input.charAt(i + 1);

            if (escapeSeq) {
                if (curr == "}") {
                    parts.push("${" + part + "}");
                    part = "";
                    i++;
                    continue;
                } else {
                    part += curr;
                    i++;
                    continue;
                }
            }

            if (curr == " " && last != "\\") {
                if (part.length < 1) {
                    i++;
                    continue;
                }

                parts.push(part);
                part = "";
                i++;
                continue;
            }

            if (curr == "$" && next == "{") {
                escapeSeq = true;
                i += 2;
                continue;
            }

            part += curr;
            i++;
        }

        if (part.length > 0)
            parts.push(part);

        return parts;
    }
}