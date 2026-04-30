export interface ICommentRecord {
    id: string;
    eventId: string;
    userId: string;
    body: string;
    createdAt: string;
  }
  
  export type Comment = ICommentRecord;
  
  export interface ICommentRepository {
    create(comment: ICommentRecord): Promise<void>;
    getById(id: string): Promise<ICommentRecord | null>;
    listByEventId(eventId: string): Promise <ICommentRecord[]>;
    delete(id: string): Promise<void>;
  }