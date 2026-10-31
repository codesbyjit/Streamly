import { VideosRepository } from "../repositories/videos.repository.js";
import type { CreateVideoInput, UpdateVideoInput } from "../schemas/video.js";

export class VideosService {
  constructor(private readonly repository = new VideosRepository()) {}

  create(input: CreateVideoInput) {
    return this.repository.create(input);
  }

  get(id: string) {
    return this.repository.findById(id);
  }

  listPublic(limit: number, cursor?: string, category?: string) {
    return this.repository.listPublic(limit, cursor, category);
  }

  update(id: string, ownerId: string, input: UpdateVideoInput) {
    return this.repository.update(id, ownerId, input);
  }

  delete(id: string, ownerId: string) {
    return this.repository.softDelete(id, ownerId);
  }

  publish(id: string, ownerId: string) {
    return this.repository.publish(id, ownerId);
  }
}