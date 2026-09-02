import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ship the Prisma query engine with every serverless function.
  //
  // Prisma's client is generated to app/generated/prisma, and the native
  // query engine next to it (libquery_engine-<platform>.node) is loaded at
  // RUNTIME by path rather than by `import`/`require`. Next.js traces bundles
  // with @vercel/nft, which works by statically analysing imports — so it
  // cannot see the engine, does not copy it into the function, and every
  // database call fails on Vercel with:
  //
  //   Prisma Client could not locate the Query Engine for runtime
  //   "rhel-openssl-3.0.x"
  //
  // while the build itself succeeds and the pages render fine. Naming the
  // directory here forces it into the trace. See https://pris.ly/d/engine-not-found-nextjs
  //
  // Keys are route globs; "/*" is the documented way to target every route.
  // Values are globs resolved from the project root.
  outputFileTracingIncludes: {
    "/*": ["./app/generated/prisma/**/*"],
  },
};

export default nextConfig;
