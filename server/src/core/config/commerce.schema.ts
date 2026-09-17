import { z } from 'zod';

export const ShippingRateSchema = z.object({
  country: z.string().trim().regex(/^[A-Z]{2}$/, 'Use an uppercase two-letter country code.'),
  feeCents: z.number().int().min(0).max(1000000),
  freeThresholdCents: z.number().int().min(0).max(100000000).nullable(),
}).strict();
export const ShippingRatesSchema = z.array(ShippingRateSchema).min(1).max(250).superRefine((rates, context) => {
  const seen = new Set<string>();
  for (const [index, rate] of rates.entries()) {
    if (seen.has(rate.country)) context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'country'], message: 'Duplicate shipping country.' });
    seen.add(rate.country);
  }
});
export type ShippingRate = z.infer<typeof ShippingRateSchema>;
// Synthetic defaults preserve local demos only. Production requires explicit rates.
export const demoShippingRates: ShippingRate[] = [{ country: 'CA', feeCents: 995, freeThresholdCents: 10000 }];
export const ShippingRatesJsonSchema = z.string().transform((value, context) => {
  try { return JSON.parse(value); }
  catch { context.addIssue({ code: z.ZodIssueCode.custom, message: 'SHIPPING_RATES_JSON must contain valid JSON.' }); return z.NEVER; }
}).pipe(ShippingRatesSchema);
