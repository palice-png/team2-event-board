export type EventStatus = "draft" | "published" | "cancelled" | "past";

export interface IEventRecord {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: EventStatus;
  capacity?: number;
  startDatetime: string;
  endDatetime: string;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
}
