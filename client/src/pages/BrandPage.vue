<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { api, type Brand } from "../api/client";

const props = defineProps<{ brandSlug: string }>();
const brand = ref<Brand | null>(null);

async function load() {
  const brands = await api.getBrands();
  brand.value = brands.find((b) => b.slug === props.brandSlug) ?? null;
}

onMounted(load);
watch(() => props.brandSlug, load);
</script>

<template>
  <div v-if="brand" class="section">
    <p class="label">{{ brand.name.toUpperCase() }} &rsaquo; Modelos</p>
    <div class="card-grid">
      <router-link
        v-for="model in brand.models"
        :key="model.id"
        :to="model.status === 'active' ? `/${brand.slug}/${model.slug}` : ''"
        class="card"
        :class="{ disabled: model.status !== 'active' }"
      >
        <div class="card-title">{{ model.name }}</div>
        <div class="card-subtitle">
          {{ model.status === "active" ? "" : "brevemente" }}
        </div>
      </router-link>
    </div>
  </div>
</template>
