import { Request, Response } from 'express';
import type { PaginationMeta } from './pagination';

interface ResponseMeta {
  requestId: string | undefined;
  timestamp: string;
}

interface SuccessEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

interface PaginatedEnvelope<T> {
  data: T[];
  pagination: PaginationMeta;
  meta: ResponseMeta;
}

function extractRequestId(req: Request): string | undefined {
  return req.headers['x-request-id'] as string | undefined;
}

function buildMeta(req: Request): ResponseMeta {
  return {
    requestId: extractRequestId(req),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Sends a success response wrapped in the standard envelope.
 */
export function sendSuccess<T>(res: Response, req: Request, data: T, statusCode = 200): void {
  const envelope: SuccessEnvelope<T> = {
    data,
    meta: buildMeta(req),
  };
  res.status(statusCode).json(envelope);
}

/**
 * Sends a 201 Created response wrapped in the standard envelope.
 */
export function sendCreated<T>(res: Response, req: Request, data: T): void {
  sendSuccess(res, req, data, 201);
}

/**
 * Sends a paginated response with the standard envelope and pagination metadata.
 */
export function sendPaginated<T>(
  res: Response,
  req: Request,
  data: T[],
  pagination: PaginationMeta,
): void {
  const envelope: PaginatedEnvelope<T> = {
    data,
    pagination,
    meta: buildMeta(req),
  };
  res.status(200).json(envelope);
}

/**
 * Sends a 204 No Content response with no body.
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}
