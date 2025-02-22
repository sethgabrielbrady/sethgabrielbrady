declare module 'vue-router' {
  interface RouteMeta {
    // Add custom meta properties here
    requiresAuth?: boolean;
  }
}

declare module '@/router' {
  import { RouteRecordRaw } from 'vue-router';

  const routes: RouteRecordRaw[];
  export default routes;
}