import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/login" },
  {
    path: "/login",
    name: "login",
    component: () => import("../views/LoginView.vue"),
    meta: { layout: "blank" },
  },
  {
    path: "/dashboard",
    name: "dashboard",
    component: () => import("../views/DashboardView.vue"),
  },
  {
    path: "/workers",
    name: "workers",
    component: () => import("../views/WorkersView.vue"),
  },
  {
    path: "/workers/new",
    name: "worker-new",
    component: () => import("../views/WorkerEditView.vue"),
  },
  {
    path: "/workers/:id",
    name: "worker-edit",
    component: () => import("../views/WorkerEditView.vue"),
  },
  {
    path: "/harvest",
    name: "harvest",
    component: () => import("../views/HarvestView.vue"),
  },
  {
    path: "/sync",
    name: "sync",
    component: () => import("../views/SyncView.vue"),
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const active = localStorage.getItem("fundoflow.active_tenant");
  if (to.name !== "login" && !active) {
    return { name: "login" };
  }
});
