export interface RawRowData {
    [key: string]: string | number;
}

export interface RawRowDataWithId extends RawRowData {
    id: number;
}

export interface PreparedData {
    columns: string[];
    keys: string[];
    prepared: { [key: string]: any };
}

export function prepareData(data: RawRowData): PreparedData {
    const preparedData: PreparedData = {columns: [], keys: [], prepared: {}};
    for (const [column, value] of Object.entries(data)) {
        const key = "$" + column;
        preparedData.keys.push(key);
        preparedData.columns.push(column);
        preparedData.prepared[key] = value;
    }
    return preparedData;
}