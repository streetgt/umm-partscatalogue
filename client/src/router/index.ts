import { createRouter, createWebHistory } from "vue-router";
import HomePage from "../pages/HomePage.vue";
import BrandPage from "../pages/BrandPage.vue";
import ModelPage from "../pages/ModelPage.vue";
import GroupDetailPage from "../pages/GroupDetailPage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: HomePage },
    { path: "/:brandSlug", component: BrandPage, props: true },
    { path: "/:brandSlug/:modelSlug", component: ModelPage, props: true },
    {
      path: "/:brandSlug/:modelSlug/:groupCode",
      component: GroupDetailPage,
      props: true,
    },
  ],
});
