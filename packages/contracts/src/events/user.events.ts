import { z } from "zod";
import { eventSchema } from "./base.event.js";

export const UserRegisteredEventSchema = eventSchema(
  "user.registered",
  1,
  z.object({
    userId: z.string().min(1),
    email: z.string().email(),
    registeredAt: z.string().datetime({ offset: true })
  })
);

export const UserProfileUpdatedEventSchema = eventSchema(
  "user.profile.updated",
  1,
  z.object({
    userId: z.string().min(1),
    changedFields: z.array(z.enum(["displayName", "avatarUrl", "bio", "bannerUrl"])).min(1)
  })
);

export const ChannelCreatedEventSchema = eventSchema(
  "channel.created",
  1,
  z.object({
    channelId: z.string().min(1),
    ownerId: z.string().min(1),
    name: z.string().min(1)
  })
);

export type UserRegisteredEvent = z.infer<typeof UserRegisteredEventSchema>;
export type UserProfileUpdatedEvent = z.infer<typeof UserProfileUpdatedEventSchema>;
export type ChannelCreatedEvent = z.infer<typeof ChannelCreatedEventSchema>;
