import { Result } from "../lib/result";

export type EventInput = {
  title: string;
  description: string;
  location: string;
  category: string;
  startDatetime: Date;
  endDatetime: Date;
};