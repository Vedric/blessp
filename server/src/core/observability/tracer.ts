import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { trace, type Tracer } from '@opentelemetry/api';

let sdk: NodeSDK | null = null;

/**
 * Initializes the OpenTelemetry SDK with auto-instrumentation for Express, HTTP,
 * and Prisma. Must be called before any other imports that load HTTP or Express
 * modules so that the instrumentation hooks are installed correctly.
 *
 * When OTEL_ENABLED is not set to "true" or OTEL_EXPORTER_OTLP_ENDPOINT is absent,
 * the tracer still initializes in a no-op mode so that manual span calls throughout
 * the codebase remain safe without conditional checks.
 */
export function startTracer(): void {
  const otelEnabled = process.env.OTEL_ENABLED === 'true';
  const exporterUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.SERVICE_NAME ?? 'blessp-api',
    [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION ?? '3.0.0',
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? 'development',
  });

  // When tracing is disabled or no exporter URL is configured, we initialize
  // the SDK without an exporter so all span calls become no-ops.
  const traceExporter =
    otelEnabled && exporterUrl
      ? new OTLPTraceExporter({ url: exporterUrl })
      : undefined;

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
}

/**
 * Gracefully shuts down the OpenTelemetry SDK, flushing any pending spans.
 */
export async function shutdownTracer(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
  }
}

/**
 * Returns a named tracer instance for creating manual spans in business-critical paths.
 */
export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}
