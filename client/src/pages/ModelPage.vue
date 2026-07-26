<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { api, type Group } from "../api/client";

const props = defineProps<{ brandSlug: string; modelSlug: string }>();
const groups = ref<Group[]>([]);
const filter = ref("");

async function load() {
  groups.value = await api.getGroups(props.brandSlug, props.modelSlug);
}

onMounted(load);
watch(() => [props.brandSlug, props.modelSlug], load);

const filtered = computed(() => {
  const f = filter.value.trim().toLowerCase();
  if (!f) return groups.value;
  return groups.value.filter(
    (g) => g.code.toLowerCase().includes(f) || g.name.toLowerCase().includes(f),
  );
});
</script>

<template>
  <div class="section">
    <input v-model="filter" class="search-input" placeholder="Filtrar grupos..." />
    <div class="card-grid">
      <router-link
        v-for="group in filtered"
        :key="group.id"
        :to="`/${brandSlug}/${modelSlug}/${group.code}`"
        class="card"
      >
        <div class="card-title">{{ group.code }}</div>
        <div class="card-subtitle">{{ group.name }}</div>
      </router-link>
    </div>
  </div>
</template>
