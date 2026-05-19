export interface Comment {
  id: string;
  videoId: string;
  userId: string;
  parentId: string | null;
  content: string;
  likeCount: number;
  replyCount: number;
  isPinned: boolean;
  createdAt: Date;
}