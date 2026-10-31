export type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";
export type AssetStatus = "PROCESSING" | "READY" | "FAILED" | "DELETED";

export interface Rendition {
  label: string;
  width: number;
  height: number;
  bandwidth: number;
  playlistKey: string;
}

export interface VideoAsset {
  videoId: string;
  ownerId: string;
  status: AssetStatus;
  visibility: Visibility;
  masterManifestKey: string;
  renditions: Rendition[];
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedUser {
  sub: string;
  roles?: string[];
}
