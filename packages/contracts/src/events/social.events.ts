import { z } from "zod";
import { eventSchema } from "./base.event.js";

export const CommentCreatedEventSchema = eventSchema(
  "social.comment.created",
  1,
  z.object({
    commentId: z.string().min(1),
    videoId: z.string().min(1),
    userId: z.string().min(1),
    parentCommentId: z.string().min(1).optional()
  })
);

export const CommentDeletedEventSchema = eventSchema(
  "social.comment.deleted",
  1,
  z.object({
    commentId: z.string().min(1),
    videoId: z.string().min(1),
    userId: z.string().min(1)
  })
);

export const ReactionChangedEventSchema = eventSchema(
  "social.reaction.changed",
  1,
  z.object({
    targetType: z.enum(["video", "comment"]),
    targetId: z.string().min(1),
    userId: z.string().min(1),
    reaction: z.enum(["like", "dislike"]).nullable()
  })
);

export const ChannelSubscribedEventSchema = eventSchema(
  "social.channel.subscribed",
  1,
  z.object({
    channelId: z.string().min(1),
    subscriberId: z.string().min(1)
  })
);

export const ChannelUnsubscribedEventSchema = eventSchema(
  "social.channel.unsubscribed",
  1,
  z.object({
    channelId: z.string().min(1),
    subscriberId: z.string().min(1)
  })
);

export type CommentCreatedEvent = z.infer<typeof CommentCreatedEventSchema>;
export type CommentDeletedEvent = z.infer<typeof CommentDeletedEventSchema>;
export type ReactionChangedEvent = z.infer<typeof ReactionChangedEventSchema>;
export type ChannelSubscribedEvent = z.infer<typeof ChannelSubscribedEventSchema>;
export type ChannelUnsubscribedEvent = z.infer<typeof ChannelUnsubscribedEventSchema>;
