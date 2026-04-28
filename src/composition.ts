import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateEventController } from "./event/EventController";
import { CreatePrismaEventRepository } from "./event/PrismaEventRepository";
import { CreateEventService } from "./event/EventService";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";
import { CreateInMemoryRsvpRepository } from "./rsvp/InMemoryRsvpRepository";
import { CreateRsvpService } from "./rsvp/RsvpService";
import { CreateRsvpController } from "./rsvp/RsvpController";
import { CreateInMemoryCommentRepository } from "./comments/InMemoryCommentRepository";
import { CreateCommentService } from "./comments/CommentService";
import { CreateCommentController } from "./comments/CommentController";

export function createComposedApp(logger?: ILoggingService): IApp {
  const resolvedLogger = logger ?? CreateLoggingService();

  const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const prismaAdapter = new PrismaBetterSqlite3({ url: databaseUrl });
  const prisma = new PrismaClient({ adapter: prismaAdapter });

  const authUsers = CreateInMemoryUserRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(
    authUsers,
    passwordHasher,
  );
  const authController = CreateAuthController(
    authService,
    adminUserService,
    resolvedLogger,
  );


  // RSVP wiring
  const rsvpRepo = CreateInMemoryRsvpRepository();
  const rsvpService = CreateRsvpService(rsvpRepo);
  const rsvpController = CreateRsvpController(rsvpService, resolvedLogger);

  //Comment wiring
  const commentRepo = CreateInMemoryCommentRepository();
  const commentService = CreateCommentService(commentRepo);
  const commentController = CreateCommentController(commentService, resolvedLogger);
  
  // Event wiring
  const eventRepository = CreatePrismaEventRepository(prisma);
  const eventService = CreateEventService(eventRepository);
  const eventController = CreateEventController(
    eventService,
    resolvedLogger,
    commentService,
  );

  return CreateApp(authController, rsvpController, eventController, commentController, resolvedLogger);
}
