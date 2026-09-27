<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import AppSidebar from "./components/AppSidebar.vue";

const route = useRoute();
const isBlank = computed(() => route.meta.layout === "blank");
</script>

<template>
  <div v-if="isBlank" class="h-screen">
    <RouterView />
  </div>
  <div v-else class="flex h-screen overflow-hidden">
    <AppSidebar />
    <RouterView />
  </div>
</template>
