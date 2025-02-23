declare module 'vue-router' {
  interface RouteMeta {
    // Add custom meta properties here
    requiresAuth?: boolean;
  }
}

declare module '@/router' {
  import { RouteRecordRaw } from 'vue-router';

  type NewType = RouteRecordRaw;

  const routes: NewType[];
  export default routes;
}