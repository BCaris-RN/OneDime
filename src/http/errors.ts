export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string
  ) {
    super(code);
  }
}
export class NotFound extends HttpError {
  constructor() {
    super(404, "record_not_found");
  }
}
export class BadRequest extends HttpError {
  constructor(code = "invalid_input") {
    super(400, code);
  }
}
export class Conflict extends HttpError {
  constructor(code = "record_conflict") {
    super(409, code);
  }
}
