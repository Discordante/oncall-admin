import {
  type RouteConfig,
  route,
  layout,
  index,
} from "@react-router/dev/routes";

export default [
  // Public routes
  route("login", "./routes/login.tsx"),
  route("oauth2/redirect", "./routes/oauth2.redirect.tsx"),

  // Protected routes (client-side JWT check via clientLoader)
  layout("./routes/_protected.tsx", [
    index("./routes/_protected.dashboard.tsx"),
  ]),
] satisfies RouteConfig;
