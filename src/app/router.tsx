import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { navigationSchema } from './navigation'
import { App } from './workspace'
const rootRoute = createRootRoute({ component: Outlet })
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (input) => navigationSchema.parse(input),
  component: App,
})
export const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute]) })
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
