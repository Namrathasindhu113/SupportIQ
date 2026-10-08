/**
 * AppError — operational error with an HTTP status code.
 *
 * Throw this anywhere in the application for known, expected errors.
 * The centralized errorHandler middleware distinguishes AppError from
 * unexpected programming errors and formats the response accordingly.
 */
class AppError extends Error {
  /**
   * @param {string}  message    Human-readable error description
   * @param {number}  statusCode HTTP status code (4xx / 5xx)
   */
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // flag used by errorHandler

    // Capture clean stack trace (V8 only, no-op elsewhere)
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
