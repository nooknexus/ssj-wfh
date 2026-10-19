"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import React, { useState } from "react";
import superjson from "superjson";
import { trpc } from "./client";
import { SessionProvider } from "next-auth/react";
import { isUnauthorizedError } from "@/lib/auth-utils";

let isRedirecting = false;

const handleUnauthorized = () => {
  if (typeof window === "undefined" || isRedirecting) {
    return;
  }
  isRedirecting = true;
  window.location.href = "/login";
};

const createQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (err) => {
        if (isUnauthorizedError(err)) {
          handleUnauthorized();
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (err) => {
        if (isUnauthorizedError(err)) {
          handleUnauthorized();
        }
      },
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (isUnauthorizedError(error)) {
            return false;
          }
          return failureCount < 3;
        },
      },
    },
  });

export const TRPCReactProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(createQueryClient);
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <SessionProvider refetchOnWindowFocus>
      <QueryClientProvider client={queryClient}>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          {children}
        </trpc.Provider>
      </QueryClientProvider>
    </SessionProvider>
  );
};
