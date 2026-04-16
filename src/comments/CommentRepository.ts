export interface ICommentRecord {
    id: string;
    eventId: string;
    userId: string;
    content: string;
    createdAt: string;
  }
  
  export type Comment = ICommentRecord;
  
  export interface ICommentRepository {
    create(comment: ICommentRecord): void;
    getById(id: string): ICommentRecord | null;
    listByEventId(eventId: string): ICommentRecord[];
    delete(id: string): void;
  }