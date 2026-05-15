// src/prisma.config.ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    // Usamos DIRECT_URL para que Prisma pueda gestionar las tablas
    url: process.env.DIRECT_URL, 
  },
});

