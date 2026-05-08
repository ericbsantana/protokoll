<script setup lang="ts">
import { ACTIVE_DEPLOYMENT } from '../lib/deployments'
</script>

<template>{{ ACTIVE_DEPLOYMENT.version }}</template>
