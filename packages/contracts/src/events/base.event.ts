import { z } from "zod";

export const EventMetadataSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  version: z.number().int().positive(),
  occurredAt: z.string().datetime({ offset: true }),
  producer: z.string().min(1),
  correlationId: z.string().min(1).optional(),
  causationId: z.string().min(1).optional()
});

export function eventSchema<
  TType extends string,
  TData extends z.ZodTypeAny
>(eventType: TType, version: number, data: TData) {
  return EventMetadataSchema.extend({
    eventType: z.literal(eventType),
    version: z.literal(version),
    data
  });
}

export type EventMetadata = z.infer<typeof EventMetadataSchema>;
export type EventEnvelope<TData> = EventMetadata & { data: TData };
