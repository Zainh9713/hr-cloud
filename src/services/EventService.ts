import { EventEmitter } from "events";

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    // Increase listener limits if needed
    this.setMaxListeners(50);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
}

export const eventBus = EventBus.getInstance();

export const EVENTS = {
  UPLOAD_COMPLETE: "upload:complete",
  FILE_DELETED: "file:deleted",
  FOLDER_MOVED: "folder:moved",
  STORAGE_RECALCULATED: "storage:recalculated",
  SHARE_CREATED: "share:created",
  JOB_PROGRESS: "job:progress",
};
