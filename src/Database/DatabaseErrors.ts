export class DatabaseError extends Error {}

export class QueryError extends DatabaseError {
    constructor(sqlQuery: string, cause: Error) {
        super(cause.message + "\nSQL Query: " + sqlQuery);
    }
}

export class QueryBuilderError extends Error {
    constructor(message: string) {
        super(message);
    }
}