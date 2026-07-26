<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/client";

const router = useRouter();
const query = ref("");

async function onSearch() {
  const q = query.value.trim();
  if (!q) return;
  const results = await api.search(q);
  if (results.length > 0) {
    const r = results[0];
    router.push(`/${r.brandSlug}/${r.modelSlug}/${r.groupCode}?highlight=${r.id}`);
  }
}
</script>

<template>
  <header class="app-header">
    <router-link to="/" class="logo">umm<sup>®</sup> <span>catálogo de peças</span></router-link>
    <input
      v-model="query"
      class="search-input"
      placeholder="Pesquisar peça, código..."
      @keyup.enter="onSearch"
    />
  </header>
</template>
