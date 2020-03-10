export type RawRowData = { [key: string]: string|number };
export type PreparedData = {
    columns: string[],
    keys: string[],
    prepared: { [key: string]: any }
}

export function prepareData(data: RawRowData): PreparedData {
    let preparedData: PreparedData = { columns: [], keys: [], prepared: {} };
    for (let [column, value] of Object.entries(data)) {
        let key = "$" + column;
        preparedData.keys.push(key);
        preparedData.columns.push(column);
        preparedData.prepared[key] = value;
    }
    return preparedData;
}