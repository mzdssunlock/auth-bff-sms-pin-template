// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user?: {
        userId: string;
        sessionId: string;
      };
      phone?: string;
      accessToken?: string;
    }
  }
}

export {};
