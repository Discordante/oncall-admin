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

    // On-Call Groups CRUD
    route("grupos", "./routes/_protected.groups.tsx"),
    route("grupos/nuevo", "./routes/_protected.groups.new.tsx"),
    route("grupos/:id", "./routes/_protected.groups.$id.tsx"),

    // Applications CRUD
    route("aplicaciones", "./routes/_protected.applications.tsx"),
    route("aplicaciones/nueva", "./routes/_protected.applications.new.tsx"),
    route("aplicaciones/:id", "./routes/_protected.applications.$id.tsx"),

    // People CRUD
    route("personas", "./routes/_protected.people.tsx"),
    route("personas/nueva", "./routes/_protected.people.new.tsx"),
    route("personas/:id", "./routes/_protected.people.$id.tsx"),
  ]),
] satisfies RouteConfig;
