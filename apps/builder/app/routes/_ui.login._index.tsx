import {
  type LoaderFunctionArgs,
  type TypedResponse,
  json,
} from "@remix-run/server-runtime";
import { useLoaderData, type MetaFunction } from "@remix-run/react";
import { findAuthenticatedUser } from "~/services/auth.server";
import env from "~/env/env.server";
import type { LoginProps } from "~/auth/index.client";
import { useLoginErrorMessage } from "~/shared/session";
import {
  comparePathnames,
  dashboardPath,
  isDashboard,
} from "~/shared/router-utils";
import { returnToCookie } from "~/services/cookie.server";
import { ClientOnly } from "~/shared/client-only";
import { lazy } from "react";
import { preventCrossOriginCookie } from "~/services/no-cross-origin-cookie";
import { redirect } from "~/services/no-store-redirect";

export const meta: MetaFunction<typeof loader> = () => {
  const metas: ReturnType<MetaFunction> = [];

  metas.push({ title: "Webstudio Login" });

  return metas;
};

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<LoginProps>> => {
  preventCrossOriginCookie(request);

  if (false === isDashboard(request)) {
    throw new Response(null, {
      status: 404,
      statusText: "Not Found",
    });
  }

  const user = await findAuthenticatedUser(request);

  const url = new URL(request.url);
  let returnTo = url.searchParams.get("returnTo");

  if (user) {
    returnTo = returnTo ?? dashboardPath();
    // Avoid loops
    if (comparePathnames(returnTo, request.url)) {
      returnTo = dashboardPath();
    }

    throw redirect(returnTo);
  }

  const headers = new Headers();

  headers.append("Set-Cookie", await returnToCookie.serialize(returnTo));

  return json(
    {
      isSecretLoginEnabled: env.DEV_LOGIN === "true",
      isGithubEnabled: Boolean(env.GH_CLIENT_ID && env.GH_CLIENT_SECRET),
      isGoogleEnabled: Boolean(
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ),
    },
    { headers }
  );
};

const Login = lazy(async () => {
  const { Login } = await import("~/auth/index.client");
  return { default: Login };
});

const LoginRoute = () => {
  const errorMessage = useLoginErrorMessage();
  const data = useLoaderData<typeof loader>();
  return (
    <ClientOnly>
      <Login {...data} errorMessage={errorMessage} />
    </ClientOnly>
  );
};

export default LoginRoute;

// Reduces Vercel function size from 29MB to 9MB for unknown reasons; effective when used in limited files.
export const config = {
  maxDuration: 30,
};