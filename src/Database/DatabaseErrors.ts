export class DatabaseError extends Error {}

export class QueryError extends DatabaseError {
    constructor(sql_query: string, cause: Error) {
        super(cause.message + "\nSQL Query: " + sql_query);
    }
}